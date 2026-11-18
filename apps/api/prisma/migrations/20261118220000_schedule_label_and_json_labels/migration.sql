-- The name of the schedules without kind becomes their label; the names kept in JSON become labels too (decision AC):
-- the sheets noted on the items of the shopping lists and checklists, the data sets and comparisons of the charts
-- (and their main one), the client service frozen on the final accounting documents. Every other key is kept.

ALTER TABLE "Workspace" RENAME COLUMN "scheduleName" TO "scheduleLabel";

-- An object with its key renamed (as it is without that key).
CREATE FUNCTION pg_temp.renamed_key(item jsonb, old_key text, new_key text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(item) = 'object' AND item ? old_key THEN (item - old_key) || jsonb_build_object(new_key, item -> old_key) ELSE item END
$$;

-- An array whose objects have their key renamed, in the same order (as it is when not an array).
CREATE FUNCTION pg_temp.renamed_keys(items jsonb, old_key text, new_key text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(items) = 'array' THEN (SELECT COALESCE(jsonb_agg(pg_temp.renamed_key(element, old_key, new_key) ORDER BY position), '[]'::jsonb) FROM jsonb_array_elements(items) WITH ORDINALITY AS t(element, position))
    ELSE items
  END
$$;

UPDATE "ShoppingItem" SET "sheetSources" = pg_temp.renamed_keys("sheetSources", 'name', 'label')
WHERE jsonb_typeof("sheetSources") = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements("sheetSources") AS t(element) WHERE element ? 'name');

UPDATE "ChecklistItem" SET "sources" = pg_temp.renamed_keys("sources", 'name', 'label')
WHERE jsonb_typeof("sources") = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements("sources") AS t(element) WHERE element ? 'name');

UPDATE "DashboardChart" SET "config" = pg_temp.renamed_key("config", 'name', 'label') WHERE "config" ? 'name';
UPDATE "DashboardChart" SET "config" = jsonb_set("config", '{datasets}', pg_temp.renamed_keys("config" -> 'datasets', 'name', 'label')) WHERE jsonb_typeof("config" -> 'datasets') = 'array';
UPDATE "DashboardChart" SET "config" = jsonb_set("config", '{comparisons}', pg_temp.renamed_keys("config" -> 'comparisons', 'name', 'label')) WHERE jsonb_typeof("config" -> 'comparisons') = 'array';

UPDATE "AccountingDocument" SET "buyer" = jsonb_set("buyer", '{service}', pg_temp.renamed_key("buyer" -> 'service', 'name', 'label'))
WHERE jsonb_typeof("buyer" -> 'service') = 'object' AND ("buyer" -> 'service') ? 'name';

DROP FUNCTION pg_temp.renamed_keys(jsonb, text, text);
DROP FUNCTION pg_temp.renamed_key(jsonb, text, text);
