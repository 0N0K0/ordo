-- A task may belong to no project: it then has no number (#12 is per project); attached to a project later, it gets
-- the next number of that project.
ALTER TABLE "Task" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "number" DROP NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "number" DROP DEFAULT;

CREATE OR REPLACE FUNCTION task_project_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."projectId" IS DISTINCT FROM OLD."projectId" THEN
    IF NEW."projectId" IS NULL THEN
      NEW."number" := NULL;
    ELSE
      PERFORM pg_advisory_xact_lock(hashtext('task-number:' || NEW."projectId"));
      SELECT COALESCE(MAX("number"), 0) + 1 INTO NEW."number" FROM "Task" WHERE "projectId" = NEW."projectId";
    END IF;
  END IF;
  RETURN NEW;
END $$;
