export type UserRole = 'GLOBAL_ADMIN' | 'ORG_ADMIN' | 'VIEWER';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  fullName: string;
  role: UserRole;
  orgId: string | null; // null for GLOBAL_ADMIN, otherwise organization id (e.g., 'miicr', 'akimat-astana')
  orgName?: string;
  createdAt: string;
}

export interface UserSession {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  orgId: string | null;
  orgName?: string;
  expiresAt: number;
}
