import { CaseStatus } from './cases.interface';

// State machine transitions
export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.DRAFT]: [CaseStatus.SUBMITTED],
  [CaseStatus.SUBMITTED]: [CaseStatus.PREAPPROVED, CaseStatus.REJECTED],
  [CaseStatus.PREAPPROVED]: [CaseStatus.CARD_ISSUED, CaseStatus.REJECTED],
  [CaseStatus.REJECTED]: [], // Terminal state - no transitions
  [CaseStatus.CARD_ISSUED]: [CaseStatus.PAID, CaseStatus.CLAIM_SUBMITTED],
  [CaseStatus.PAID]: [CaseStatus.CLAIM_SUBMITTED],
  [CaseStatus.CLAIM_SUBMITTED]: [CaseStatus.IN_REVIEW],
  [CaseStatus.IN_REVIEW]: [CaseStatus.SETTLED, CaseStatus.CLAIM_SUBMITTED], // Can go back to CLAIM_SUBMITTED
  [CaseStatus.SETTLED]: [CaseStatus.CLOSED, CaseStatus.IN_REVIEW], // Can go back to IN_REVIEW
  [CaseStatus.CLOSED]: [], // Terminal state - no transitions
};

// Backward transitions (ops only)
export const BACKWARD_TRANSITIONS: Partial<Record<CaseStatus, CaseStatus[]>> = {
  [CaseStatus.IN_REVIEW]: [CaseStatus.CLAIM_SUBMITTED],
  [CaseStatus.SETTLED]: [CaseStatus.IN_REVIEW],
};
