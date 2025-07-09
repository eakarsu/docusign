import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function createTestDocument() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // PAGE 1
  const page1 = pdfDoc.addPage([612, 792]); // Standard letter size

  // Add title
  page1.drawText('Sample Service Agreement', {
    x: 50,
    y: 750,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Add content for page 1
  const page1Content = [
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
    '4. Additional terms and conditions apply as outlined below.',
    '',
    'INITIAL SIGNATURES (Page 1):',
    '',
    'Client Initial: _________________________ Date: _________',
    '',
    'Provider Initial: _______________________ Date: _________',
  ];

  let yPosition = 700;
  for (const line of page1Content) {
    page1.drawText(line, {
      x: 50,
      y: yPosition,
      size: 12,
      font: line.includes(':') && !line.includes('Date:') ? boldFont : font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
  }

  // PAGE 2
  const page2 = pdfDoc.addPage([612, 792]);

  // Add content for page 2
  const page2Content = [
    'ADDITIONAL TERMS AND CONDITIONS',
    '',
    '4. Liability and Indemnification:',
    '   - Service provider liability is limited to the contract value',
    '   - Client agrees to indemnify provider against third-party claims',
    '',
    '5. Termination:',
    '   - Either party may terminate with 30 days written notice',
    '   - All work completed up to termination date will be paid',
    '',
    '6. Intellectual Property:',
    '   - All work product belongs to the client upon full payment',
    '   - Provider retains rights to general methodologies and know-how',
    '',
    'FINAL SIGNATURES (Page 2):',
    '',
    'By signing below, both parties agree to all terms and conditions.',
    '',
    'CLIENT:',
    'Signature: _________________________ Date: _________',
    'Print Name: _________________________',
    '',
    'SERVICE PROVIDER:',
    'Signature: _________________________ Date: _________',
    'Print Name: _________________________',
  ];

  yPosition = 750;
  for (const line of page2Content) {
    page2.drawText(line, {
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
