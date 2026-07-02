export interface CostShareRule {
  id: string;
  name: string;
  deductibleAmount: number;
  copayPercentage: number;
  copayCap: number | null;
  applyAtSettlement: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
  deletedAt?: Date | null;
}
