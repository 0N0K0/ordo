-- A deleted project no longer deletes its tasks (decision D4): they leave it, as in a transfer out of any project.
-- The API takes them out first (numbers, milestones, sprints, GitHub items and the links leaving the tree); SET NULL
-- is the safety net (the "task_project_number" trigger then clears the number). Existing rows are not changed.
ALTER TABLE "Task" DROP CONSTRAINT "Task_projectId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
