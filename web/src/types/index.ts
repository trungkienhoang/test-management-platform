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

