-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BugStatus" ADD VALUE 'VERIFIED';
ALTER TYPE "BugStatus" ADD VALUE 'REOPENED';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "bug_seq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "test_case_seq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "parent_run_id" TEXT;

-- CreateIndex
CREATE INDEX "bugs_test_execution_id_idx" ON "bugs"("test_execution_id");

-- CreateIndex
CREATE INDEX "bugs_test_case_id_idx" ON "bugs"("test_case_id");

-- CreateIndex
CREATE INDEX "bugs_project_id_status_idx" ON "bugs"("project_id", "status");

-- CreateIndex
CREATE INDEX "test_executions_executed_by_id_idx" ON "test_executions"("executed_by_id");

-- CreateIndex
CREATE INDEX "test_executions_test_run_id_status_idx" ON "test_executions"("test_run_id", "status");

-- CreateIndex
CREATE INDEX "test_runs_parent_run_id_idx" ON "test_runs"("parent_run_id");

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
