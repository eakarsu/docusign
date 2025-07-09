import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function createTestDocument() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Standard letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add title
  page.drawText('Sample Service Agreement', {
    x: 50,
    y: 750,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Add content
  const content = [
    'This is a sample service agreement document for testing purposes.',
    '',
    'PARTIES:',
    'Client: [CLIENT_NAME]',
    'Service Provider: [PROVIDER_NAME]',
    '',
    'TERMS:',
    '1. The service provider agrees to provide the following services:',
    '   - Web development services',
    '   - Technical support',
    '   - Maintenance and updates',
    '',
    '2. Payment terms: Net 30 days',
    '',
    '3. This agreement shall remain in effect for one (1) year.',
    '',
    'SIGNATURES:',
    '',
    'Client Signature: _________________________ Date: _________',
    '',
    'Provider Signature: _______________________ Date: _________',
  ];

  let yPosition = 700;
  for (const line of content) {
    page.drawText(line, {
      x: 50,
      y: yPosition,
      size: 12,
      font: line.includes(':') && !line.includes('Date:') ? boldFont : font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
  }

  const pdfBytes = await pdfDoc.save();
  
  // Save to uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const filePath = path.join(uploadsDir, 'sample-service-agreement.pdf');
  fs.writeFileSync(filePath, pdfBytes);
  
  return '/uploads/documents/sample-service-agreement.pdf';
}
