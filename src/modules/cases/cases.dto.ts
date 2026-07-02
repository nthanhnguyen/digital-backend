import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  // IsPhoneNumber,
} from 'class-validator';
import { CaseStatus, ReasonCategory } from './cases.interface';

export class CreateCaseDto {
  @ApiProperty({ example: 'Queen Mary Hospital' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  hospitalName: string;

  @ApiProperty({ example: '2024-01-20T09:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  plannedVisitAt: string;

  @ApiProperty({ enum: ReasonCategory, example: ReasonCategory.GENERAL_CONSULTATION })
  @IsEnum(ReasonCategory)
  @IsNotEmpty()
  reasonCategory: ReasonCategory;

  @ApiProperty({ required: false, example: '+84 912 345 678' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false, example: 'Annual checkup' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CaseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  hospitalName: string;

  @ApiProperty()
  plannedVisitAt: Date;

  @ApiProperty({ enum: ReasonCategory })
  reasonCategory: ReasonCategory;

  @ApiProperty({ required: false })
  contactPhone?: string;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty({ enum: CaseStatus })
  status: CaseStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  approvedAmount: number | null;

  @ApiProperty({ required: false })
  approvedCurrency?: string;
}

export class UpdateCaseStatusDto {
  @ApiProperty({ enum: CaseStatus })
  @IsEnum(CaseStatus)
  @IsNotEmpty()
  status: CaseStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class SubmitCaseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: CaseStatus })
  status: CaseStatus;

  @ApiProperty()
  submittedAt: Date;
}

export class GetCasesQueryDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, enum: CaseStatus })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @ApiProperty({ required: false, default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class CaseListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  hospitalName: string;

  @ApiProperty()
  plannedVisitAt: Date;

  @ApiProperty({ enum: ReasonCategory })
  reasonCategory: ReasonCategory;

  @ApiProperty({ enum: CaseStatus })
  status: CaseStatus;

  @ApiProperty({ nullable: true })
  approvedAmount: number | null;

  @ApiProperty({ required: false })
  approvedCurrency?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class GetCasesResponseDto {
  @ApiProperty({ type: [CaseListItemDto] })
  data: CaseListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class CoverageTierDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  amount: number;
}

export class CardDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  limitAmount: number;

  @ApiProperty()
  limitCurrency: string;

  @ApiProperty()
  usedAmount: number;

  @ApiProperty()
  activeFrom: Date;

  @ApiProperty()
  activeTo: Date;
}

export class ClaimDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  billAmount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class SettlementDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  paymentLinkUrl: string | null;
}

export class CaseTimelineItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  actorType: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  createdAt: Date;
}

export class CaseDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  hospitalName: string;

  @ApiProperty()
  plannedVisitAt: Date;

  @ApiProperty({ enum: ReasonCategory })
  reasonCategory: ReasonCategory;

  @ApiProperty({ required: false })
  contactPhone?: string;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty({ enum: CaseStatus })
  status: CaseStatus;

  @ApiProperty({ nullable: true })
  approvedAmount: number | null;

  @ApiProperty({ required: false })
  approvedCurrency?: string;

  @ApiProperty({ nullable: true })
  bufferAmount: number | null;

  @ApiProperty({ required: false, type: CoverageTierDto })
  coverageTier?: CoverageTierDto;

  @ApiProperty({ required: false, type: CardDto })
  card?: CardDto;

  @ApiProperty({ required: false, type: ClaimDto })
  claim?: ClaimDto;

  @ApiProperty({ nullable: true, type: SettlementDto })
  settlement: SettlementDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true })
  approvedAt: Date | null;

  @ApiProperty({ type: [CaseTimelineItemDto] })
  timeline: CaseTimelineItemDto[];
}

export class GetCaseDetailResponseDto {
  @ApiProperty({ type: CaseDetailDto })
  data: CaseDetailDto;
}

export class GetOpsCasesQueryDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, description: 'Comma-separated case statuses' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, description: 'Filter by created date (from)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ required: false, description: 'Filter by created date (to)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({ required: false, default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ required: false, default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({
    required: false,
    description: 'Search by keyword (case id, hospital name, user name, user email)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class OpsCaseUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class OpsCaseListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: OpsCaseUserDto })
  user: OpsCaseUserDto;

  @ApiProperty()
  hospitalName: string;

  @ApiProperty()
  plannedVisitAt: Date;

  @ApiProperty({ enum: ReasonCategory })
  reasonCategory: ReasonCategory;

  @ApiProperty({ enum: CaseStatus })
  status: CaseStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;
}

export class GetOpsCasesResponseDto {
  @ApiProperty({ type: [OpsCaseListItemDto] })
  data: OpsCaseListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class OpsCaseDetailUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  bankAccountNumber: string | null;

  @ApiProperty({ nullable: true })
  bankCode: string | null;
}

export class UserLimitsDto {
  @ApiProperty()
  perCase: number;

  @ApiProperty()
  remainingToday: number;

  @ApiProperty()
  remainingThisYear: number;
}

export class AuditLogItemDto {
  @ApiProperty()
  action: string;

  @ApiProperty()
  actor: string;

  @ApiProperty()
  timestamp: Date;
}

export class OpsCaseDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: OpsCaseDetailUserDto })
  user: OpsCaseDetailUserDto;

  @ApiProperty()
  hospitalName: string;

  @ApiProperty()
  plannedVisitAt: Date;

  @ApiProperty({ enum: ReasonCategory })
  reasonCategory: ReasonCategory;

  @ApiProperty({ nullable: true })
  contactPhone: string | null;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty({ enum: CaseStatus })
  status: CaseStatus;

  @ApiProperty({ nullable: true })
  approvedAmount: number | null;

  @ApiProperty({ nullable: true })
  approvedCurrency: string | null;

  @ApiProperty({ nullable: true })
  bufferAmount: number | null;

  @ApiProperty({ type: UserLimitsDto })
  userLimits: UserLimitsDto;

  @ApiProperty({ nullable: true, type: CoverageTierDto })
  coverageTier: CoverageTierDto | null;

  @ApiProperty({ nullable: true, type: CardDto })
  card: CardDto | null;

  @ApiProperty({ nullable: true, type: ClaimDto })
  claim: ClaimDto | null;

  @ApiProperty({ nullable: true, type: SettlementDto })
  settlement: SettlementDto | null;

  @ApiProperty({ type: [AuditLogItemDto] })
  auditLogs: AuditLogItemDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true })
  approvedAt: Date | null;
}

export class GetOpsCaseDetailResponseDto {
  @ApiProperty({ type: OpsCaseDetailDto })
  data: OpsCaseDetailDto;
}

// Claim submission DTOs
export enum ClaimDocumentType {
  BILL = 'BILL',
  RECEIPT = 'RECEIPT',
  ITEMIZED_STATEMENT = 'ITEMIZED_STATEMENT',
  OUT_OF_POCKET_PROOF = 'OUT_OF_POCKET_PROOF',
  OTHER = 'OTHER',
}

export class ClaimDocumentInputDto {
  @ApiProperty({ example: 'https://storage.example.com/docs/bill-123.pdf' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ example: 'hospital_bill.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  fileType: string;

  @ApiProperty({ example: 245000 })
  @IsInt()
  @Min(1)
  fileSize: number;

  @ApiProperty({ enum: ClaimDocumentType, example: ClaimDocumentType.BILL })
  @IsEnum(ClaimDocumentType)
  @IsNotEmpty()
  documentType: ClaimDocumentType;
}

export class SubmitClaimDto {
  @ApiProperty({ example: 8500.0 })
  @IsNotEmpty()
  @Min(0.01)
  billAmount: number;

  @ApiProperty({ example: 'VND' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  billCurrency: string;

  @ApiProperty({ example: '2024-01-20' })
  @IsDateString()
  @IsNotEmpty()
  billDate: string;

  @ApiProperty({ required: false, example: 0 })
  @IsOptional()
  @Min(0)
  outOfPocketAmount?: number;

  @ApiProperty({ type: [ClaimDocumentInputDto] })
  @IsArray()
  @IsNotEmpty()
  @Min(1)
  @Max(10)
  documents: ClaimDocumentInputDto[];

  @ApiProperty({ example: true })
  @IsNotEmpty()
  declarationAccepted: boolean;
}

export class ClaimDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty({ enum: ClaimDocumentType })
  documentType: ClaimDocumentType;
}

export class SubmitClaimResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  caseId: string;

  @ApiProperty()
  billAmount: number;

  @ApiProperty()
  billCurrency: string;

  @ApiProperty()
  billDate: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [ClaimDocumentResponseDto] })
  documents: ClaimDocumentResponseDto[];

  @ApiProperty()
  submittedAt: Date;
}

export class SubmitClaimDataResponseDto {
  @ApiProperty({ type: SubmitClaimResponseDto })
  data: SubmitClaimResponseDto;
}
