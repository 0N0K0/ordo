-- Task numbers become per project (each project and sub-project has its own 1, 2, 3…), given by the database.
-- Existing tasks are renumbered in their project, in their former order; the "#12" written in the texts become
-- links by task id ("[#3](?task=<id>)"), so that they keep pointing at the same task.

-- New numbers, from the former (global) ones.
CREATE TEMP TABLE task_renumbering AS
SELECT "id", "number" AS "old", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "number")::int AS "new"
FROM "Task";

-- "#12" not glued to a word (as the app reads them) becomes a link to the task by its id, labelled with its new number.
CREATE FUNCTION pg_temp.link_task_references(body text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  reference text;
  target record;
BEGIN
  IF body IS NULL OR position('#' IN body) = 0 THEN
    RETURN body;
  END IF;
  FOR reference IN SELECT DISTINCT (regexp_matches(body, '(?:^|[^[:alnum:]_&/\[])#([0-9]{1,9})(?![0-9])', 'g'))[1] LOOP
    SELECT "id", "new" INTO target FROM task_renumbering WHERE "old" = reference::int;
    IF FOUND THEN
      body := regexp_replace(body, '(^|[^[:alnum:]_&/\[])#' || reference || '(?![0-9])', '\1[#' || target."new" || '](?task=' || target."id" || ')', 'g');
    END IF;
  END LOOP;
  RETURN body;
END $$;

UPDATE "Task" SET "description" = pg_temp.link_task_references("description") WHERE "description" LIKE '%#%';
UPDATE "TaskComment" SET "body" = pg_temp.link_task_references("body") WHERE "body" LIKE '%#%';
UPDATE "Milestone" SET "description" = pg_temp.link_task_references("description") WHERE "description" LIKE '%#%';
UPDATE "Sprint" SET "goal" = pg_temp.link_task_references("goal") WHERE "goal" LIKE '%#%';
UPDATE "CalendarEvent" SET "description" = pg_temp.link_task_references("description") WHERE "description" LIKE '%#%';
UPDATE "CalendarEventException" SET "description" = pg_temp.link_task_references("description") WHERE "description" LIKE '%#%';

-- Renumbering (the global unique number goes first).
DROP INDEX "Task_number_key";
ALTER TABLE "Task" ALTER COLUMN "number" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "Task_number_seq";
UPDATE "Task" SET "number" = r."new" FROM task_renumbering r WHERE r."id" = "Task"."id";
ALTER TABLE "Task" ALTER COLUMN "number" SET DEFAULT 0;
CREATE UNIQUE INDEX "Task_projectId_number_key" ON "Task"("projectId", "number");
DROP TABLE task_renumbering;

-- The next number of the project, on creation and on a transfer to another project (a lock per project keeps
-- concurrent creations apart).
CREATE FUNCTION task_project_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."projectId" IS DISTINCT FROM OLD."projectId" THEN
    PERFORM pg_advisory_xact_lock(hashtext('task-number:' || NEW."projectId"));
    SELECT COALESCE(MAX("number"), 0) + 1 INTO NEW."number" FROM "Task" WHERE "projectId" = NEW."projectId";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER task_project_number BEFORE INSERT OR UPDATE OF "projectId" ON "Task" FOR EACH ROW EXECUTE PROCEDURE task_project_number();
