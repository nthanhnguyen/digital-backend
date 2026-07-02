import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { BadRequestError, ERRORS } from 'src/common';
import {
  UploadedDocument,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES_COUNT,
} from './uploads.interface';
import type { Express } from 'express';

@Injectable()
export class UploadsService {
  private readonly documentsPath: string;

  constructor() {
    // Set documents folder path at the root of the project
    this.documentsPath = path.join(process.cwd(), 'documents');
  }

  async uploadFiles(files: Express.Multer.File[]): Promise<UploadedDocument[]> {
    if (!files || files.length === 0) {
      throw new BadRequestError(ERRORS.UPLOAD_001, 'UPLOAD_001');
    }

    if (files.length > MAX_FILES_COUNT) {
      throw new BadRequestError(ERRORS.UPLOAD_003, 'UPLOAD_003');
    }

    for (const file of files) {
      this.validateFile(file);
    }

    // Ensure documents directory exists
    await this.ensureDocumentsDirectory();

    const uploadedDocuments: UploadedDocument[] = [];

    for (const file of files) {
      const ext = path.extname(file.originalname);

      const uuidFileName = `${randomUUID()}${ext}`;
      const filePath = path.join(this.documentsPath, uuidFileName);

      // Write file to disk
      await fs.writeFile(filePath, file.buffer);

      uploadedDocuments.push({
        fileUrl: filePath,
        fileName: uuidFileName,
        fileType: file.mimetype,
        fileSize: this.formatFileSize(file.size),
      });
    }

    return uploadedDocuments;
  }

  private validateFile(file: Express.Multer.File): void {
    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      throw new BadRequestError(ERRORS.UPLOAD_001, 'UPLOAD_001');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestError(ERRORS.UPLOAD_002, 'UPLOAD_002');
    }
  }

  private async ensureDocumentsDirectory(): Promise<void> {
    try {
      await fs.access(this.documentsPath);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.documentsPath, { recursive: true });
    }
  }

  private formatFileSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    const value = mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1);
    return `${value} MB`;
  }
}
