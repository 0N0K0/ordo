-- The label column of the tables is `label` (decision BI): the old ids `title` (tasks, routines, catalog, accounting
-- documents) and `name` (recurring invoices, sheets, shopping lists and their items, base list, work schedules) are
-- renamed in the saved views of those tables only (column order, hidden columns, widths, sorts, grouping, footer and
-- filter conditions), and in the task columns new views of a workspace start with. The other tables keep their ids
-- (the `name` of a person is not a label).

-- The id itself, `label` for the old one.
CREATE FUNCTION pg_temp.aliased_id(id jsonb, old_id text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN id = to_jsonb(old_id) THEN '"label"'::jsonb ELSE id END
$$;

-- An array of ids, the old one renamed, in the same order (as it is when not an array).
CREATE FUNCTION pg_temp.aliased_ids(ids jsonb, old_id text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(ids) = 'array' THEN (SELECT COALESCE(jsonb_agg(pg_temp.aliased_id(element, old_id) ORDER BY position), '[]'::jsonb) FROM jsonb_array_elements(ids) WITH ORDINALITY AS t(element, position))
    ELSE ids
  END
$$;

-- An object keyed by column, the old key renamed (as it is without that key).
CREATE FUNCTION pg_temp.aliased_key(item jsonb, old_id text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(item) = 'object' AND item ? old_id THEN (item - old_id) || jsonb_build_object('label', item -> old_id) ELSE item END
$$;

-- An array of sorts ({ id, desc }), the old id renamed, in the same order.
CREATE FUNCTION pg_temp.aliased_sorts(sorts jsonb, old_id text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(sorts) = 'array' THEN (
      SELECT COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(element) = 'object' AND element ? 'id' THEN jsonb_set(element, '{id}', pg_temp.aliased_id(element -> 'id', old_id)) ELSE element END ORDER BY position), '[]'::jsonb)
      FROM jsonb_array_elements(sorts) WITH ORDINALITY AS t(element, position)
    )
    ELSE sorts
  END
$$;

-- A filter group or condition, the old id renamed in the field of every condition, at any depth.
CREATE FUNCTION pg_temp.aliased_filter(node jsonb, old_id text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF jsonb_typeof(node) <> 'object' THEN
    RETURN node;
  END IF;
  IF jsonb_typeof(node -> 'children') = 'array' THEN
    RETURN jsonb_set(node, '{children}', (
      SELECT COALESCE(jsonb_agg(pg_temp.aliased_filter(child, old_id) ORDER BY position), '[]'::jsonb)
      FROM jsonb_array_elements(node -> 'children') WITH ORDINALITY AS t(child, position)
    ));
  END IF;
  IF node ? 'field' THEN
    RETURN jsonb_set(node, '{field}', pg_temp.aliased_id(node -> 'field', old_id));
  END IF;
  RETURN node;
END
$$;

-- A saved view (or a column layout) with the old id of its label column renamed wherever a column id is kept.
CREATE FUNCTION pg_temp.with_label_column(config jsonb, old_id text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result jsonb := config;
BEGIN
  IF jsonb_typeof(config) <> 'object' THEN
    RETURN config;
  END IF;
  IF result ? 'columnOrder' THEN result := jsonb_set(result, '{columnOrder}', pg_temp.aliased_ids(result -> 'columnOrder', old_id)); END IF;
  IF result ? 'hiddenColumns' THEN result := jsonb_set(result, '{hiddenColumns}', pg_temp.aliased_ids(result -> 'hiddenColumns', old_id)); END IF;
  IF result ? 'columnSizing' THEN result := jsonb_set(result, '{columnSizing}', pg_temp.aliased_key(result -> 'columnSizing', old_id)); END IF;
  IF result ? 'footer' THEN result := jsonb_set(result, '{footer}', pg_temp.aliased_key(result -> 'footer', old_id)); END IF;
  IF result ? 'sorting' THEN result := jsonb_set(result, '{sorting}', pg_temp.aliased_sorts(result -> 'sorting', old_id)); END IF;
  IF result ? 'groupBy' THEN result := jsonb_set(result, '{groupBy}', pg_temp.aliased_id(result -> 'groupBy', old_id)); END IF;
  IF result ? 'filter' THEN result := jsonb_set(result, '{filter}', pg_temp.aliased_filter(result -> 'filter', old_id)); END IF;
  RETURN result;
END
$$;

-- `title`: the tasks, routines, catalog and accounting documents (and the task and routine views of the old kinds).
UPDATE "TaskView" SET "config" = pg_temp.with_label_column("config", 'title')
WHERE (("kind" = 'TABLE' AND ("tableKey" IN ('tasks', 'routines', 'catalog', 'project-documents') OR "tableKey" LIKE 'documents-%')) OR "kind" IN ('TASKS', 'ROUTINES'))
  AND "config" <> pg_temp.with_label_column("config", 'title');

-- `name`: the recurring invoices, sheets, shopping lists, their items, the base list and the work schedules (and the
-- shopping list views of the old kind).
UPDATE "TaskView" SET "config" = pg_temp.with_label_column("config", 'name')
WHERE (("kind" = 'TABLE' AND "tableKey" IN ('recurring-invoices', 'sheets', 'shopping-lists', 'shopping-list', 'shopping-base-list', 'work-schedules')) OR "kind" = 'SHOPPING_LISTS')
  AND "config" <> pg_temp.with_label_column("config", 'name');

-- The task columns new views of a workspace start with.
UPDATE "Workspace" SET "taskColumns" = pg_temp.with_label_column("taskColumns", 'title')
WHERE "taskColumns" IS NOT NULL AND "taskColumns" <> pg_temp.with_label_column("taskColumns", 'title');

DROP FUNCTION pg_temp.with_label_column(jsonb, text);
DROP FUNCTION pg_temp.aliased_filter(jsonb, text);
DROP FUNCTION pg_temp.aliased_sorts(jsonb, text);
DROP FUNCTION pg_temp.aliased_key(jsonb, text);
DROP FUNCTION pg_temp.aliased_ids(jsonb, text);
DROP FUNCTION pg_temp.aliased_id(jsonb, text);
