-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TEST_RUN_REVIEW_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'TEST_RUN_REWORK_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'TEST_RUN_COMPLETED';

-- AlterEnum
ALTER TYPE "TestRunStatus" ADD VALUE 'IN_REVIEW';

-- AlterTable
ALTER TABLE "test_runs" ADD COLUMN     "rework_reason" TEXT;
