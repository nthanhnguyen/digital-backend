export interface UploadedDocument {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: string;
}

export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
export const MAX_FILES_COUNT = 2;
