import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
  IsDateString,
  IsInt,
  Min,
  IsArray,
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClaimDocumentType, ClaimStatus } from './claims.interface';

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
  @ApiProperty({ example: 8500.0, description: 'Bill total amount (must be positive)' })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
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
  @IsNumber()
  @Min(0)
  outOfPocketAmount?: number;

  @ApiProperty({ type: [ClaimDocumentInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ClaimDocumentInputDto)
  documents: ClaimDocumentInputDto[];

  @ApiProperty({ example: true })
  @IsBoolean()
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

// GET claim detail DTOs
export class ClaimDocumentDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty({ enum: ClaimDocumentType })
  documentType: ClaimDocumentType;

  @ApiProperty()
  fileSize: number;
}

export class ClaimDetailDto {
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

  @ApiProperty({ nullable: true })
  outOfPocketAmount: number | null;

  @ApiProperty({ nullable: true })
  reviewedBillAmount: number | null;

  @ApiProperty({ nullable: true })
  isValid: boolean | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [ClaimDocumentDetailDto] })
  documents: ClaimDocumentDetailDto[];

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true })
  reviewedAt: Date | null;
}

export class GetClaimDetailResponseDto {
  @ApiProperty({ type: ClaimDetailDto })
  data: ClaimDetailDto;
}

// Ops claims list DTOs
export class OpsClaimsQueryDto {
  @ApiProperty({ required: false, default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    required: false,
    description: 'Filter by claim status',
    enum: ClaimStatus,
  })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @ApiProperty({
    required: false,
    description: 'Search by keyword (claim id, case id, hospital name, user name, user email)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class OpsClaimCaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  hospitalName: string;

  @ApiProperty({ nullable: true })
  approvedAmount: number | null;
}

export class OpsClaimUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class OpsClaimListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: OpsClaimCaseDto })
  case: OpsClaimCaseDto;

  @ApiProperty({ type: OpsClaimUserDto })
  user: OpsClaimUserDto;

  @ApiProperty()
  billAmount: number;

  @ApiProperty()
  billDate: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;
}

export class OpsClaimsMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class GetOpsClaimsResponseDto {
  @ApiProperty({ type: [OpsClaimListItemDto] })
  data: OpsClaimListItemDto[];

  @ApiProperty({ type: OpsClaimsMetaDto })
  meta: OpsClaimsMetaDto;
}

// Ops claim detail DTOs
export class OpsClaimDetailCaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  hospitalName: string;

  @ApiProperty({ nullable: true })
  approvedAmount: number | null;

  @ApiProperty({ nullable: true })
  approvedCurrency: string | null;
}

export class OpsClaimDetailDocumentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty({ enum: ClaimDocumentType })
  documentType: ClaimDocumentType;

  @ApiProperty()
  fileSize: number;
}

export class OpsClaimTransactionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ nullable: true })
  merchantName: string | null;

  @ApiProperty({ nullable: true })
  merchantCategory: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  transactionAt: Date;
}

export enum SettlementType {
  COLLECT = 'COLLECT',
  PAYOUT = 'PAYOUT',
  NONE = 'NONE',
}

export class SettlementPreviewDto {
  @ApiProperty()
  reviewedBillAmount: number;

  @ApiProperty()
  insurerLiability: number;

  @ApiProperty()
  deductible: number;

  @ApiProperty()
  copayAmount: number;

  @ApiProperty()
  userCostShare: number;

  @ApiProperty()
  platformExpectedPay: number;

  @ApiProperty()
  cardPaidAmount: number;

  @ApiProperty()
  difference: number;

  @ApiProperty({ enum: SettlementType })
  settlementType: SettlementType;
}

export class OpsClaimDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: OpsClaimDetailCaseDto })
  case: OpsClaimDetailCaseDto;

  @ApiProperty({ type: OpsClaimUserDto })
  user: OpsClaimUserDto;

  @ApiProperty()
  billAmount: number;

  @ApiProperty()
  billCurrency: string;

  @ApiProperty()
  billDate: string;

  @ApiProperty({ nullable: true })
  outOfPocketAmount: number | null;

  @ApiProperty({ nullable: true })
  reviewedBillAmount: number | null;

  @ApiProperty({ nullable: true })
  isValid: boolean | null;

  @ApiProperty({ nullable: true })
  reviewNotes: string | null;

  @ApiProperty({ enum: ClaimStatus })
  status: ClaimStatus;

  @ApiProperty({ type: [OpsClaimDetailDocumentDto] })
  documents: OpsClaimDetailDocumentDto[];

  @ApiProperty({ type: [OpsClaimTransactionDto] })
  transactions: OpsClaimTransactionDto[];

  @ApiProperty({ type: SettlementPreviewDto, nullable: true })
  settlementPreview: SettlementPreviewDto | null;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;
}

export class GetOpsClaimDetailResponseDto {
  @ApiProperty({ type: OpsClaimDetailDto })
  data: OpsClaimDetailDto;
}

// Review claim DTOs
export class ReviewClaimDto {
  @ApiProperty({ example: 8500.0, description: 'Reviewed bill amount (must be positive)' })
  @IsNumber()
  @IsPositive()
  reviewedBillAmount: number;

  @ApiProperty({ example: true, description: 'Whether the claim is valid' })
  @IsBoolean()
  isValid: boolean;

  @ApiProperty({ required: false, example: 'All documents verified', description: 'Review notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}

export class ReviewClaimResponseDataDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reviewedBillAmount: number;

  @ApiProperty()
  isValid: boolean;

  @ApiProperty({ enum: ClaimStatus })
  status: ClaimStatus;

  @ApiProperty()
  reviewedAt: Date;
}

export class ReviewClaimResponseDto {
  @ApiProperty({ type: ReviewClaimResponseDataDto })
  data: ReviewClaimResponseDataDto;
}
