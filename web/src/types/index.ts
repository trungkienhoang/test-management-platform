export type SystemRole = 'ADMIN' | 'USER';

export type ProjectRole = 'QA_LEAD' | 'TESTER' | 'DEVELOPER' | 'VIEWER';

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  systemRole: SystemRole;
  isActive?: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  _count?: {
    members: number;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination?: PaginationMeta;
  meta?: PaginationMeta;
}

// ─────────────────────────────────────────
// SPRINT 2: TEST SUITES & TEST CASES
// ─────────────────────────────────────────

export type TestCasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TestCaseStatus = 'DRAFT' | 'READY' | 'DEPRECATED';

export interface TestCaseStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    testCases: number;
  };
}

export interface TestSuiteTreeNode {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  testCaseCount: number;
  totalCaseCount: number;
  children: TestSuiteTreeNode[];
}

export interface TestCase {
  id: string;
  projectId: string;
  suiteId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  preconditions?: string | null;
  steps: TestCaseStep[];
  priority: TestCasePriority;
  status: TestCaseStatus;
  tags: string[];
  order: number;
  version: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  suite?: {
    id: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface TestCaseHistory {
  id: string;
  testCaseId: string;
  version: number;
  title: string;
  description?: string | null;
  preconditions?: string | null;
  steps: TestCaseStep[];
  priority: TestCasePriority;
  status: TestCaseStatus;
  tags: string[];
  changedById: string;
  changeReason?: string | null;
  createdAt: string;
  changedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
}

// ─────────────────────────────────────────
// SPRINT 3: TEST RUNS, EXECUTIONS, BUGS & NOTIFICATIONS
// ─────────────────────────────────────────

export type TestRunStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';

export type TestExecutionStatus =
  | 'UNTESTED'
  | 'PASSED'
  | 'FAILED'
  | 'BLOCKED'
  | 'SKIPPED';

export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type NotificationType =
  | 'TEST_RUN_ASSIGNED'
  | 'BUG_ASSIGNED'
  | 'BUG_STATUS_CHANGED'
  | 'SYSTEM';

export interface TestRunStats {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  untested: number;
  passRate: number;
  completionRate?: number;
}

export interface TestExecution {
  id: string;
  testRunId: string;
  testCaseId?: string | null;
  testCaseCode: string;
  testCaseTitle: string;
  testCasePreconditions?: string | null;
  testCaseSteps: TestCaseStep[];
  testCasePriority: TestCasePriority;
  testCaseVersion: number;
  status: TestExecutionStatus;
  actualResult?: string | null;
  stepResults?: Record<string, boolean> | null;
  attachments: string[];
  executedById?: string | null;
  executedAt?: string | null;
  executionDurationMs?: number | null;
  createdAt: string;
  updatedAt: string;
  executedBy?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  testCase?: {
    id: string;
    code: string;
    title: string;
    suiteId?: string | null;
  } | null;
  bugs?: Bug[];
}

export interface TestRun {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  status: TestRunStatus;
  createdById: string;
  assignedToId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  };
  assignedTo?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  executions?: TestExecution[];
  stats?: TestRunStats;
  _count?: {
    executions: number;
  };
}

export interface Bug {
  id: string;
  projectId: string;
  testExecutionId?: string | null;
  testCaseId?: string | null;
  code: string;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  createdById: string;
  assigneeId?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  };
  assignee?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  testCase?: {
    id: string;
    code: string;
    title: string;
    priority?: TestCasePriority;
  } | null;
  testExecution?: {
    id: string;
    testRunId: string;
    status: TestExecutionStatus;
    actualResult?: string | null;
    stepResults?: any;
    testCaseCode: string;
    testCaseTitle: string;
    testRun?: {
      id: string;
      title?: string;
      name?: string;
    };
  } | null;
}

export interface BugSummary {
  total: number;
  byStatus: {
    OPEN: number;
    IN_PROGRESS: number;
    RESOLVED: number;
    CLOSED: number;
  };
  bySeverity: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  activeBugs: number;
  resolvedRate: number;
}

export interface Notification {
  id: string;
  userId: string;
  projectId?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}


