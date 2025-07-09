import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SignatureRequestData {
  documentTitle: string;
  senderName: string;
  signerName: string;
  documentId: string;
  signUrl: string;
}

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"DocuSign AI" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      
      logger.info(`Email sent successfully to ${options.to}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  static async sendSignatureRequest(data: SignatureRequestData): Promise<void> {
    const subject = `Signature Request: ${data.documentTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Signature Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0; 
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📝 Signature Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.signerName},</h2>
            <p>${data.senderName} has sent you a document to sign:</p>
            <h3>"${data.documentTitle}"</h3>
            <p>Please review and sign the document by clicking the button below:</p>
            <a href="${data.signUrl}" class="button">Review & Sign Document</a>
            <p><strong>Important:</strong> This is a legally binding document. Please review it carefully before signing.</p>
            <p>If you have any questions, please contact ${data.senderName} directly.</p>
          </div>
          <div class="footer">
            <p>This email was sent by DocuSign AI Clone. If you received this email in error, please ignore it.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Signature Request: ${data.documentTitle}
      
      Hello ${data.signerName},
      
      ${data.senderName} has sent you a document to sign: "${data.documentTitle}"
      
      Please review and sign the document at: ${data.signUrl}
      
      This is a legally binding document. Please review it carefully before signing.
      
      If you have any questions, please contact ${data.senderName} directly.
    `;

    await this.sendEmail({
      to: data.signerName,
      subject,
      html,
      text,
    });
  }

  static async sendDocumentCompleted(data: {
    documentTitle: string;
    senderEmail: string;
    senderName: string;
    completedAt: string;
  }): Promise<void> {
    const subject = `Document Completed: ${data.documentTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Completed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4caf50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Document Completed</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.senderName},</h2>
            <p>Great news! Your document has been fully signed:</p>
            <h3>"${data.documentTitle}"</h3>
            <p><strong>Completed on:</strong> ${new Date(data.completedAt).toLocaleString()}</p>
            <p>All required signatures have been collected. You can now download the completed document from your dashboard.</p>
          </div>
          <div class="footer">
            <p>This email was sent by DocuSign AI Clone.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: data.senderEmail,
      subject,
      html,
    });
  }

  static async sendSignatureReminder(data: SignatureRequestData): Promise<void> {
    const subject = `Reminder: Signature Required for ${data.documentTitle}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Signature Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ff9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #ff9800; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0; 
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Signature Reminder</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.signerName},</h2>
            <p>This is a friendly reminder that you have a document waiting for your signature:</p>
            <h3>"${data.documentTitle}"</h3>
            <p>Sent by: ${data.senderName}</p>
            <p>Please take a moment to review and sign the document:</p>
            <a href="${data.signUrl}" class="button">Sign Document Now</a>
            <p>If you have any questions, please contact ${data.senderName} directly.</p>
          </div>
          <div class="footer">
            <p>This email was sent by DocuSign AI Clone.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: data.signerName,
      subject,
      html,
    });
  }
}
