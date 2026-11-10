-- CreateTable
CREATE TABLE "TaskStatusChange" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "statusId" TEXT,
    "closed" BOOLEAN NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskStatusChange_taskId_at_idx" ON "TaskStatusChange"("taskId", "at");

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every change of the status or of the open / closed state of a task is recorded (with the previous state, at
-- the creation of the task, the first time), whatever writes it.
CREATE FUNCTION "record_task_status"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "TaskStatusChange" ("id", "taskId", "statusId", "closed", "at")
    VALUES ('c' || md5(random()::text || clock_timestamp()::text), NEW."id", NEW."statusId", NEW."closedAt" IS NOT NULL, NEW."createdAt");
  ELSIF NEW."statusId" IS DISTINCT FROM OLD."statusId" OR (NEW."closedAt" IS NULL) <> (OLD."closedAt" IS NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM "TaskStatusChange" WHERE "taskId" = NEW."id") THEN
      INSERT INTO "TaskStatusChange" ("id", "taskId", "statusId", "closed", "at")
      VALUES ('c' || md5(random()::text || clock_timestamp()::text), OLD."id", OLD."statusId", OLD."closedAt" IS NOT NULL, OLD."createdAt");
    END IF;
    INSERT INTO "TaskStatusChange" ("id", "taskId", "statusId", "closed", "at")
    VALUES ('c' || md5(random()::text || clock_timestamp()::text), NEW."id", NEW."statusId", NEW."closedAt" IS NOT NULL, now() AT TIME ZONE 'UTC');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Task_record_status"
AFTER INSERT OR UPDATE OF "statusId", "closedAt" ON "Task"
FOR EACH ROW EXECUTE PROCEDURE "record_task_status"();
