-- CreateEnum
CREATE TYPE "TestCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('DRAFT', 'READY', 'DEPRECATED');

-- CreateTable
CREATE TABLE "test_suites" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "suite_id" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "preconditions" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "priority" "TestCasePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TestCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_histories" (
    "id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "preconditions" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "priority" "TestCasePriority" NOT NULL,
    "status" "TestCaseStatus" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "changed_by_id" TEXT NOT NULL,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_suites_project_id_idx" ON "test_suites"("project_id");

-- CreateIndex
CREATE INDEX "test_suites_parent_id_idx" ON "test_suites"("parent_id");

-- CreateIndex
CREATE INDEX "test_cases_project_id_idx" ON "test_cases"("project_id");

-- CreateIndex
CREATE INDEX "test_cases_suite_id_idx" ON "test_cases"("suite_id");

-- CreateIndex
CREATE INDEX "test_cases_priority_idx" ON "test_cases"("priority");

-- CreateIndex
CREATE INDEX "test_cases_status_idx" ON "test_cases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_project_id_code_key" ON "test_cases"("project_id", "code");

-- CreateIndex
CREATE INDEX "test_case_histories_test_case_id_idx" ON "test_case_histories"("test_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_case_histories_test_case_id_version_key" ON "test_case_histories"("test_case_id", "version");

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "test_suites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_histories" ADD CONSTRAINT "test_case_histories_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_histories" ADD CONSTRAINT "test_case_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
