import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import { LocalFileService } from './localFileService';
import { createError } from '../middleware/errorHandler';

interface SignatureField {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  signatureData: string;
}

interface TextExtraction {
  text: string;
  coordinates: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
  }>;
}

export class PDFService {
  static async extractTextFromPDF(fileBuffer: Buffer): Promise<TextExtraction> {
    try {
      // For now, we'll use a generic approach since pdf-lib doesn't have built-in text extraction
      // In a production environment, you'd use libraries like pdf-parse or pdf2pic + OCR
      
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const pages = pdfDoc.getPages();
      
      // Generic patterns that work across different document types
      const signaturePatterns = [
        /signature\s*:?\s*[_\s]{3,}/gi,
        /sign\s*:?\s*[_\s]{3,}/gi,
        /signed\s*:?\s*[_\s]{3,}/gi,
        /name\s*:?\s*[_\s]{3,}/gi,
        /date\s*:?\s*[_\s]{3,}/gi,
        /witness\s*:?\s*[_\s]{3,}/gi,
        /address\s*:?\s*[_\s]{3,}/gi,
        /initial\s*:?\s*[_\s]{3,}/gi,
        /__{5,}/g, // Long underlines (5 or more underscores)
        /\.{5,}/g, // Dotted lines
        /\[.*?\]/g, // Bracketed placeholders like [SIGN HERE]
      ];
      
      // Return generic structure - in real implementation this would parse actual PDF content
      return {
        text: 'Generic document content - text extraction would be implemented with pdf-parse or similar library',
        coordinates: [] // Would be populated by actual text extraction
      };
    } catch (error) {
      throw createError('Failed to extract text from PDF', 500);
    }
  }

  static async addSignaturesToPDF(
    originalFileUrl: string,
    signatures: SignatureField[]
  ): Promise<Buffer> {
    try {
      // Read the original PDF from local storage
      const originalBuffer = await LocalFileService.getFileBuffer(originalFileUrl);
      
      // Load the PDF
      const pdfDoc = await PDFDocument.load(originalBuffer);
      const pages = pdfDoc.getPages();
      
      // Add signatures to each page
      for (const signature of signatures) {
        const page = pages[signature.page - 1];
        if (!page) continue;
        
        // Convert base64 signature to image
        const signatureImageBytes = this.base64ToBuffer(signature.signatureData);
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
        
        // Add signature to page
        page.drawImage(signatureImage, {
          x: signature.x,
          y: page.getHeight() - signature.y - signature.height, // PDF coordinates are bottom-up
          width: signature.width,
          height: signature.height,
        });
      }
      
      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      return Buffer.from(modifiedPdfBytes);
    } catch (error) {
      throw createError('Failed to add signatures to PDF', 500);
    }
  }

  static async addTextFieldsToPDF(
    originalFileUrl: string,
    textFields: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      page: number;
      text: string;
      fontSize?: number;
    }>
  ): Promise<Buffer> {
    try {
      const originalBuffer = await LocalFileService.getFileBuffer(originalFileUrl);
      
      const pdfDoc = await PDFDocument.load(originalBuffer);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      for (const field of textFields) {
        const page = pages[field.page - 1];
        if (!page) continue;
        
        page.drawText(field.text, {
          x: field.x,
          y: page.getHeight() - field.y - (field.fontSize || 12),
          size: field.fontSize || 12,
          font,
          color: rgb(0, 0, 0),
        });
      }
      
      const modifiedPdfBytes = await pdfDoc.save();
      return Buffer.from(modifiedPdfBytes);
    } catch (error) {
      throw createError('Failed to add text fields to PDF', 500);
    }
  }

  static async createPDFFromTemplate(
    templateData: {
      title: string;
      content: string;
      fields: Array<{
        type: string;
        label: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Standard letter size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Add title
      page.drawText(templateData.title, {
        x: 50,
        y: 750,
        size: 20,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      // Add content
      const lines = templateData.content.split('\n');
      let yPosition = 700;
      
      for (const line of lines) {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;
      }
      
      // Add field placeholders
      for (const field of templateData.fields) {
        // Draw field border
        page.drawRectangle({
          x: field.x,
          y: 792 - field.y - field.height,
          width: field.width,
          height: field.height,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });
        
        // Add field label
        page.drawText(field.label, {
          x: field.x + 5,
          y: 792 - field.y - field.height + 5,
          size: 10,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      throw createError('Failed to create PDF from template', 500);
    }
  }

  static async generateAuditTrail(documentData: {
    title: string;
    signatures: Array<{
      signerName: string;
      signerEmail: string;
      signedAt: string;
      ipAddress?: string;
      userAgent?: string;
    }>;
    createdAt: string;
    completedAt: string;
  }): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      let yPosition = 750;
      
      // Title
      page.drawText('Audit Trail Report', {
        x: 50,
        y: yPosition,
        size: 20,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 40;
      
      // Document info
      page.drawText(`Document: ${documentData.title}`, {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 25;
      
      page.drawText(`Created: ${new Date(documentData.createdAt).toLocaleString()}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
      
      page.drawText(`Completed: ${new Date(documentData.completedAt).toLocaleString()}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 40;
      
      // Signatures
      page.drawText('Signature History:', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 30;
      
      for (const signature of documentData.signatures) {
        page.drawText(`• ${signature.signerName} (${signature.signerEmail})`, {
          x: 70,
          y: yPosition,
          size: 12,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;
        
        page.drawText(`  Signed: ${new Date(signature.signedAt).toLocaleString()}`, {
          x: 70,
          y: yPosition,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;
        
        if (signature.ipAddress) {
          page.drawText(`  IP Address: ${signature.ipAddress}`, {
            x: 70,
            y: yPosition,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
          yPosition -= 15;
        }
        
        yPosition -= 10;
      }
      
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      throw createError('Failed to generate audit trail', 500);
    }
  }

  private static base64ToBuffer(base64: string): Buffer {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }
}
