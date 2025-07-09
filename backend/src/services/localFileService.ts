import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createError } from '../middleware/errorHandler';

export class LocalFileService {
  private static uploadsDir = path.join(process.cwd(), 'uploads');

  static async init() {
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  static async uploadFile(file: Express.Multer.File, key: string): Promise<string> {
    try {
      await this.init();
      
      const filePath = path.join(this.uploadsDir, key);
      const fileDir = path.dirname(filePath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      
      // Write file to local storage
      fs.writeFileSync(filePath, file.buffer);
      
      // Return the file URL (relative path for serving)
      return `/uploads/${key}`;
    } catch (error) {
      throw createError('Failed to upload file', 500);
    }
  }

  static async getFileUrl(key: string): Promise<string> {
    // For local files, we just return the path
    // The express server should serve static files from /uploads
    return `/uploads/${key.replace('/uploads/', '')}`;
  }

  static async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadsDir, key.replace('/uploads/', ''));
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      throw createError('Failed to delete file', 500);
    }
  }

  static async getFileBuffer(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.uploadsDir, key.replace('/uploads/', ''));
      
      if (!fs.existsSync(filePath)) {
        throw createError('File not found', 404);
      }
      
      return fs.readFileSync(filePath);
    } catch (error) {
      throw createError('Failed to read file', 500);
    }
  }

  static getFilePath(key: string): string {
    return path.join(this.uploadsDir, key.replace('/uploads/', ''));
  }
}
