export interface User {
  id: string;
  googleSub?: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  bankAccountNumber?: string;
  bankCode?: string;
  bankName?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export enum UserRole {
  USER = 'USER',
  OPS_ADMIN = 'OPS_ADMIN',
  OPS_REVIEWER = 'OPS_REVIEWER',
  FINANCE = 'FINANCE',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}
