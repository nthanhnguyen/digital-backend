export enum ClaimStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SETTLED = 'SETTLED',
}

export enum ClaimDocumentType {
  BILL = 'BILL',
  RECEIPT = 'RECEIPT',
  ITEMIZED_STATEMENT = 'ITEMIZED_STATEMENT',
  OUT_OF_POCKET_PROOF = 'OUT_OF_POCKET_PROOF',
  OTHER = 'OTHER',
}

export interface ClaimDocument {
  id: string;
  claimId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: ClaimDocumentType;
  uploadedAt: Date;
  deletedAt?: Date | null;
}

export interface Claim {
  id: string;
  caseId: string;
  billAmount: number;
  billCurrency: string;
  billDate: Date;
  outOfPocketAmount?: number | null;
  declarationAccepted: boolean;
  reviewedBillAmount?: number | null;
  isValid?: boolean | null;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  status: ClaimStatus;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
  deletedAt?: Date | null;
}
