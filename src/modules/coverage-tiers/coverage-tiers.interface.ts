export interface CoverageTier {
  id: string;
  label: string;
  amount: number;
  currency: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
  deletedAt?: Date | null;
}
