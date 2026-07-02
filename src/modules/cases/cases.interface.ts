export enum CaseStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PREAPPROVED = 'PREAPPROVED',
  REJECTED = 'REJECTED',
  CARD_ISSUED = 'CARD_ISSUED',
  PAID = 'PAID',
  CLAIM_SUBMITTED = 'CLAIM_SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  SETTLED = 'SETTLED',
  CLOSED = 'CLOSED',
}

export enum ReasonCategory {
  GENERAL_CONSULTATION = 'general_consultation',
  SPECIALIST_CONSULTATION = 'specialist_consultation',
  SURGERY = 'surgery',
  EMERGENCY = 'emergency',
  DENTAL = 'dental',
  MATERNITY = 'maternity',
  PHYSIOTHERAPY = 'physiotherapy',
  OTHER = 'other',
}

export interface Case {
  id: string;
  userId: string;
  hospitalName: string;
  plannedVisitAt: Date;
  reasonCategory: ReasonCategory;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  status: CaseStatus;

  // Pre-approval fields
  approvedBy?: string;
  approvedAmount?: number | null;
  approvedCurrency?: string;
  coverageTierId?: string;
  bufferAmount?: number | null;
  rejectionReason?: string;

  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface CaseStatusTransition {
  from: CaseStatus;
  to: CaseStatus;
  actorId: string;
  metadata?: Record<string, unknown>;
}
