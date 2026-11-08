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

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
