import { ApiProperty } from '@nestjs/swagger';

export class UploadedDocumentDto {
  @ApiProperty({ example: '/documents/example.pdf' })
  fileUrl: string;

  @ApiProperty({ example: 'example.pdf' })
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  fileType: string;

  @ApiProperty({ example: '3MB' })
  fileSize: string;
}

export class UploadPresignResponseDto {
  @ApiProperty({ type: [UploadedDocumentDto] })
  documents: UploadedDocumentDto[];
}

export class UploadPresignDataResponseDto {
  @ApiProperty({ type: UploadPresignResponseDto })
  data: UploadPresignResponseDto;
}
