import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadsService, UploadPresignDataResponseDto, MAX_FILES_COUNT } from 'src/modules/uploads';
import type { Express } from 'express';

@ApiTags('Mobile Uploads')
@Controller('mobile/uploads')
export class MobileUploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload files and get file URLs' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        inputFiles: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          maxItems: MAX_FILES_COUNT,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Files uploaded successfully',
    type: UploadPresignDataResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid files' })
  @UseInterceptors(FilesInterceptor('inputFiles', MAX_FILES_COUNT))
  async uploadPresign(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadPresignDataResponseDto> {
    const documents = await this.uploadsService.uploadFiles(files);

    return {
      data: {
        documents,
      },
    };
  }
}
