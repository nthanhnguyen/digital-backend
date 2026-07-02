import { ApiProperty } from '@nestjs/swagger';

export class CoverageTierDto {
  @ApiProperty({ example: 'tier-uuid-1' })
  id: string;

  @ApiProperty({ example: 'Basic' })
  label: string;

  @ApiProperty({ example: 5000.0 })
  amount: number;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  sortOrder: number;
}

export class GetCoverageTiersResponseDto {
  @ApiProperty({ type: [CoverageTierDto] })
  data: CoverageTierDto[];
}
