/**
 * Settlement type: COLLECT (customer pays us), PAYOUT (we pay customer), NONE.
 */
export enum SettlementType {
  COLLECT = 'COLLECT',
  PAYOUT = 'PAYOUT',
  NONE = 'NONE',
}

/**
 * Settlement status in the lifecycle.
 */
export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Settlement {
  id: string;
  caseId: string;
  type: SettlementType;
  amount: number;
  currency: string;
  status: SettlementStatus;
  airwallexPaymentLinkId: string | null;
  airwallexPaymentLinkUrl: string | null;
  airwallexTransferId: string | null;
  calculationDetails: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  completedAt: Date | null;
  deletedAt: Date | null;
}
