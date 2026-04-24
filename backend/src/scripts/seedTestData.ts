import { PrismaClient, UserRole, DocumentStatus, SignatureStatus, FieldType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedTestData() {
  console.log('Seeding comprehensive test data...');

  try {
    // Clear existing data
    await prisma.aIAnalysis.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.signature.deleteMany();
    await prisma.documentField.deleteMany();
    await prisma.document.deleteMany();
    await prisma.template.deleteMany();
    await prisma.user.deleteMany();

    const hashedPassword = await bcrypt.hash('password123', 12);

    // ==================== USERS (20) ====================
    const users = await Promise.all([
      prisma.user.create({ data: { email: 'admin@docusign.com', password: hashedPassword, firstName: 'Admin', lastName: 'User', role: UserRole.ADMIN, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'john.doe@company.com', password: hashedPassword, firstName: 'John', lastName: 'Doe', role: UserRole.SENDER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'jane.smith@company.com', password: hashedPassword, firstName: 'Jane', lastName: 'Smith', role: UserRole.SENDER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'bob.wilson@company.com', password: hashedPassword, firstName: 'Bob', lastName: 'Wilson', role: UserRole.SENDER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'alice.johnson@company.com', password: hashedPassword, firstName: 'Alice', lastName: 'Johnson', role: UserRole.SENDER, isEmailVerified: false } }),
      prisma.user.create({ data: { email: 'charlie.brown@client.com', password: hashedPassword, firstName: 'Charlie', lastName: 'Brown', role: UserRole.SIGNER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'diana.prince@client.com', password: hashedPassword, firstName: 'Diana', lastName: 'Prince', role: UserRole.SIGNER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'edward.norton@client.com', password: hashedPassword, firstName: 'Edward', lastName: 'Norton', role: UserRole.SIGNER, isEmailVerified: false } }),
      prisma.user.create({ data: { email: 'fiona.apple@partner.com', password: hashedPassword, firstName: 'Fiona', lastName: 'Apple', role: UserRole.SIGNER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'george.lucas@partner.com', password: hashedPassword, firstName: 'George', lastName: 'Lucas', role: UserRole.SIGNER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'hannah.montana@viewer.com', password: hashedPassword, firstName: 'Hannah', lastName: 'Montana', role: UserRole.VIEWER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'ivan.drago@viewer.com', password: hashedPassword, firstName: 'Ivan', lastName: 'Drago', role: UserRole.VIEWER, isEmailVerified: false } }),
      prisma.user.create({ data: { email: 'julia.roberts@company.com', password: hashedPassword, firstName: 'Julia', lastName: 'Roberts', role: UserRole.SENDER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'kevin.hart@company.com', password: hashedPassword, firstName: 'Kevin', lastName: 'Hart', role: UserRole.SENDER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'lisa.simpson@client.com', password: hashedPassword, firstName: 'Lisa', lastName: 'Simpson', role: UserRole.SIGNER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'mike.tyson@client.com', password: hashedPassword, firstName: 'Mike', lastName: 'Tyson', role: UserRole.SIGNER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'nancy.drew@partner.com', password: hashedPassword, firstName: 'Nancy', lastName: 'Drew', role: UserRole.SIGNER, isEmailVerified: false } }),
      prisma.user.create({ data: { email: 'oscar.wilde@viewer.com', password: hashedPassword, firstName: 'Oscar', lastName: 'Wilde', role: UserRole.VIEWER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'patricia.arquette@company.com', password: hashedPassword, firstName: 'Patricia', lastName: 'Arquette', role: UserRole.SENDER, isEmailVerified: true } }),
      prisma.user.create({ data: { email: 'demo@example.com', password: hashedPassword, firstName: 'Demo', lastName: 'User', role: UserRole.ADMIN, isEmailVerified: true } }),
    ]);
    console.log(`Created ${users.length} users`);

    const [admin, john, jane, bob, alice, charlie, diana, edward, fiona, george, hannah, ivan, julia, kevin, lisa, mike, nancy, oscar, patricia, demo] = users;

    // ==================== DOCUMENTS (20) ====================
    const documents = await Promise.all([
      prisma.document.create({ data: { title: 'Service Level Agreement - Q1 2025', description: 'SLA for cloud hosting services with 99.9% uptime guarantee', originalFileName: 'sla-q1-2025.pdf', fileUrl: '/uploads/documents/sla-q1-2025.pdf', fileSize: 245000, mimeType: 'application/pdf', status: DocumentStatus.DRAFT, senderId: john.id } }),
      prisma.document.create({ data: { title: 'Non-Disclosure Agreement - TechCorp', description: 'Mutual NDA between our company and TechCorp for project collaboration', originalFileName: 'nda-techcorp.pdf', fileUrl: '/uploads/documents/nda-techcorp.pdf', fileSize: 180000, mimeType: 'application/pdf', status: DocumentStatus.SENT, senderId: john.id } }),
      prisma.document.create({ data: { title: 'Employment Contract - Software Engineer', description: 'Full-time employment agreement for senior software engineer position', originalFileName: 'employment-se.pdf', fileUrl: '/uploads/documents/employment-se.pdf', fileSize: 320000, mimeType: 'application/pdf', status: DocumentStatus.COMPLETED, senderId: jane.id, completedAt: new Date('2025-01-15') } }),
      prisma.document.create({ data: { title: 'Vendor Agreement - Office Supplies', description: 'Annual vendor contract for office supply procurement', originalFileName: 'vendor-supplies.pdf', fileUrl: '/uploads/documents/vendor-supplies.pdf', fileSize: 195000, mimeType: 'application/pdf', status: DocumentStatus.IN_PROGRESS, senderId: bob.id } }),
      prisma.document.create({ data: { title: 'Lease Agreement - Building A', description: 'Commercial lease for Building A, 3rd floor office space', originalFileName: 'lease-building-a.pdf', fileUrl: '/uploads/documents/lease-building-a.pdf', fileSize: 450000, mimeType: 'application/pdf', status: DocumentStatus.SENT, senderId: alice.id } }),
      prisma.document.create({ data: { title: 'Partnership Agreement - Marketing Co', description: 'Strategic partnership for co-marketing initiatives', originalFileName: 'partnership-marketing.pdf', fileUrl: '/uploads/documents/partnership-marketing.pdf', fileSize: 280000, mimeType: 'application/pdf', status: DocumentStatus.DRAFT, senderId: john.id } }),
      prisma.document.create({ data: { title: 'Software License Agreement', description: 'Enterprise software license for development tools suite', originalFileName: 'software-license.pdf', fileUrl: '/uploads/documents/software-license.pdf', fileSize: 150000, mimeType: 'application/pdf', status: DocumentStatus.COMPLETED, senderId: jane.id, completedAt: new Date('2025-02-01') } }),
      prisma.document.create({ data: { title: 'Consulting Agreement - Data Analytics', description: 'Data analytics consulting engagement for 6 months', originalFileName: 'consulting-analytics.pdf', fileUrl: '/uploads/documents/consulting-analytics.pdf', fileSize: 210000, mimeType: 'application/pdf', status: DocumentStatus.SENT, senderId: bob.id } }),
      prisma.document.create({ data: { title: 'Independent Contractor Agreement', description: 'Contract for freelance web development work', originalFileName: 'contractor-webdev.pdf', fileUrl: '/uploads/documents/contractor-webdev.pdf', fileSize: 175000, mimeType: 'application/pdf', status: DocumentStatus.DRAFT, senderId: julia.id } }),
      prisma.document.create({ data: { title: 'Non-Compete Agreement', description: 'Non-compete clause for departing senior employee', originalFileName: 'non-compete.pdf', fileUrl: '/uploads/documents/non-compete.pdf', fileSize: 120000, mimeType: 'application/pdf', status: DocumentStatus.CANCELLED, senderId: kevin.id } }),
      prisma.document.create({ data: { title: 'Real Estate Purchase Agreement', description: 'Property purchase agreement for warehouse facility', originalFileName: 'purchase-warehouse.pdf', fileUrl: '/uploads/documents/purchase-warehouse.pdf', fileSize: 520000, mimeType: 'application/pdf', status: DocumentStatus.IN_PROGRESS, senderId: patricia.id } }),
      prisma.document.create({ data: { title: 'Insurance Policy Renewal', description: 'Annual business insurance policy renewal documentation', originalFileName: 'insurance-renewal.pdf', fileUrl: '/uploads/documents/insurance-renewal.pdf', fileSize: 380000, mimeType: 'application/pdf', status: DocumentStatus.COMPLETED, senderId: john.id, completedAt: new Date('2025-01-28') } }),
      prisma.document.create({ data: { title: 'Board Resolution - Budget Approval', description: 'Board resolution for FY2025 budget approval', originalFileName: 'board-resolution.pdf', fileUrl: '/uploads/documents/board-resolution.pdf', fileSize: 165000, mimeType: 'application/pdf', status: DocumentStatus.SENT, senderId: admin.id } }),
      prisma.document.create({ data: { title: 'Equipment Lease Agreement', description: 'Lease agreement for manufacturing equipment', originalFileName: 'equipment-lease.pdf', fileUrl: '/uploads/documents/equipment-lease.pdf', fileSize: 290000, mimeType: 'application/pdf', status: DocumentStatus.DRAFT, senderId: bob.id } }),
      prisma.document.create({ data: { title: 'Merger Agreement Draft', description: 'Preliminary merger agreement with subsidiary company', originalFileName: 'merger-draft.pdf', fileUrl: '/uploads/documents/merger-draft.pdf', fileSize: 680000, mimeType: 'application/pdf', status: DocumentStatus.DRAFT, senderId: admin.id } }),
      prisma.document.create({ data: { title: 'Franchise Agreement', description: 'Franchise licensing agreement for new territory', originalFileName: 'franchise-agreement.pdf', fileUrl: '/uploads/documents/franchise-agreement.pdf', fileSize: 420000, mimeType: 'application/pdf', status: DocumentStatus.SENT, senderId: jane.id } }),
      prisma.document.create({ data: { title: 'Data Processing Agreement', description: 'GDPR-compliant data processing agreement', originalFileName: 'dpa-gdpr.pdf', fileUrl: '/uploads/documents/dpa-gdpr.pdf', fileSize: 230000, mimeType: 'application/pdf', status: DocumentStatus.COMPLETED, senderId: julia.id, completedAt: new Date('2025-02-10') } }),
      prisma.document.create({ data: { title: 'Intellectual Property Assignment', description: 'IP assignment for patent transfer', originalFileName: 'ip-assignment.pdf', fileUrl: '/uploads/documents/ip-assignment.pdf', fileSize: 185000, mimeType: 'application/pdf', status: DocumentStatus.IN_PROGRESS, senderId: kevin.id } }),
      prisma.document.create({ data: { title: 'Confidentiality Agreement - Project X', description: 'Confidentiality agreement for classified project', originalFileName: 'confidentiality-x.pdf', fileUrl: '/uploads/documents/confidentiality-x.pdf', fileSize: 140000, mimeType: 'application/pdf', status: DocumentStatus.DRAFT, senderId: patricia.id } }),
      prisma.document.create({ data: { title: 'Maintenance Contract - IT Systems', description: 'Annual IT systems maintenance and support contract', originalFileName: 'maintenance-it.pdf', fileUrl: '/uploads/documents/maintenance-it.pdf', fileSize: 260000, mimeType: 'application/pdf', status: DocumentStatus.EXPIRED, senderId: demo.id } }),
    ]);
    console.log(`Created ${documents.length} documents`);

    // ==================== DOCUMENT FIELDS (20+) ====================
    const fieldData = documents.slice(0, 15).flatMap((doc, i) => [
      { documentId: doc.id, type: FieldType.SIGNATURE, label: `Signature ${i + 1}`, x: 100, y: 600, width: 200, height: 50, page: 1, required: true, signerEmail: charlie.email },
      { documentId: doc.id, type: FieldType.DATE, label: `Date ${i + 1}`, x: 350, y: 600, width: 120, height: 30, page: 1, required: true },
    ]);
    await prisma.documentField.createMany({ data: fieldData });
    console.log(`Created ${fieldData.length} document fields`);

    // ==================== SIGNATURES (20) ====================
    const signatureData = [
      { documentId: documents[1].id, signerId: charlie.id, signerEmail: charlie.email, signerName: 'Charlie Brown', status: SignatureStatus.PENDING },
      { documentId: documents[1].id, signerId: diana.id, signerEmail: diana.email, signerName: 'Diana Prince', status: SignatureStatus.PENDING },
      { documentId: documents[2].id, signerId: charlie.id, signerEmail: charlie.email, signerName: 'Charlie Brown', status: SignatureStatus.SIGNED, signedAt: new Date('2025-01-15'), signatureData: 'base64-sig-data-1', ipAddress: '192.168.1.1' },
      { documentId: documents[2].id, signerId: fiona.id, signerEmail: fiona.email, signerName: 'Fiona Apple', status: SignatureStatus.SIGNED, signedAt: new Date('2025-01-14'), signatureData: 'base64-sig-data-2', ipAddress: '192.168.1.2' },
      { documentId: documents[3].id, signerId: george.id, signerEmail: george.email, signerName: 'George Lucas', status: SignatureStatus.SIGNED, signedAt: new Date('2025-01-20'), signatureData: 'base64-sig-data-3', ipAddress: '10.0.0.1' },
      { documentId: documents[3].id, signerId: lisa.id, signerEmail: lisa.email, signerName: 'Lisa Simpson', status: SignatureStatus.PENDING },
      { documentId: documents[4].id, signerId: mike.id, signerEmail: mike.email, signerName: 'Mike Tyson', status: SignatureStatus.PENDING },
      { documentId: documents[4].id, signerId: nancy.id, signerEmail: nancy.email, signerName: 'Nancy Drew', status: SignatureStatus.PENDING },
      { documentId: documents[6].id, signerId: edward.id, signerEmail: edward.email, signerName: 'Edward Norton', status: SignatureStatus.SIGNED, signedAt: new Date('2025-02-01'), signatureData: 'base64-sig-data-4', ipAddress: '172.16.0.1' },
      { documentId: documents[7].id, signerId: fiona.id, signerEmail: fiona.email, signerName: 'Fiona Apple', status: SignatureStatus.PENDING },
      { documentId: documents[7].id, signerId: george.id, signerEmail: george.email, signerName: 'George Lucas', status: SignatureStatus.DECLINED },
      { documentId: documents[10].id, signerId: charlie.id, signerEmail: charlie.email, signerName: 'Charlie Brown', status: SignatureStatus.SIGNED, signedAt: new Date('2025-02-05'), signatureData: 'base64-sig-data-5', ipAddress: '192.168.2.1' },
      { documentId: documents[10].id, signerId: diana.id, signerEmail: diana.email, signerName: 'Diana Prince', status: SignatureStatus.PENDING },
      { documentId: documents[11].id, signerId: lisa.id, signerEmail: lisa.email, signerName: 'Lisa Simpson', status: SignatureStatus.SIGNED, signedAt: new Date('2025-01-28'), signatureData: 'base64-sig-data-6', ipAddress: '10.0.0.5' },
      { documentId: documents[12].id, signerId: mike.id, signerEmail: mike.email, signerName: 'Mike Tyson', status: SignatureStatus.PENDING },
      { documentId: documents[15].id, signerId: edward.id, signerEmail: edward.email, signerName: 'Edward Norton', status: SignatureStatus.PENDING },
      { documentId: documents[15].id, signerId: nancy.id, signerEmail: nancy.email, signerName: 'Nancy Drew', status: SignatureStatus.PENDING },
      { documentId: documents[16].id, signerId: charlie.id, signerEmail: charlie.email, signerName: 'Charlie Brown', status: SignatureStatus.SIGNED, signedAt: new Date('2025-02-10'), signatureData: 'base64-sig-data-7', ipAddress: '192.168.3.1' },
      { documentId: documents[16].id, signerId: george.id, signerEmail: george.email, signerName: 'George Lucas', status: SignatureStatus.SIGNED, signedAt: new Date('2025-02-09'), signatureData: 'base64-sig-data-8', ipAddress: '172.16.1.1' },
      { documentId: documents[17].id, signerId: diana.id, signerEmail: diana.email, signerName: 'Diana Prince', status: SignatureStatus.PENDING },
    ];
    await prisma.signature.createMany({ data: signatureData });
    console.log(`Created ${signatureData.length} signatures`);

    // ==================== TEMPLATES (18) ====================
    const templates = await Promise.all([
      prisma.template.create({ data: { name: 'Standard Service Agreement', description: 'General service agreement with payment terms and deliverables', creatorId: john.id, fileUrl: '/uploads/templates/service-agreement.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Client Signature","x":100,"y":700},{"type":"DATE","label":"Date","x":350,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Mutual NDA', description: 'Bilateral non-disclosure agreement for business partnerships', creatorId: john.id, fileUrl: '/uploads/templates/mutual-nda.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Party A Signature","x":100,"y":650},{"type":"SIGNATURE","label":"Party B Signature","x":350,"y":650}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Employment Offer Letter', description: 'Standard employment offer with compensation and benefits details', creatorId: jane.id, fileUrl: '/uploads/templates/offer-letter.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Employee Signature","x":100,"y":700},{"type":"DATE","label":"Start Date","x":350,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Vendor Service Contract', description: 'Contract template for engaging third-party vendors', creatorId: bob.id, fileUrl: '/uploads/templates/vendor-contract.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Vendor Signature","x":100,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Residential Lease', description: 'Standard residential property lease agreement', creatorId: alice.id, fileUrl: '/uploads/templates/residential-lease.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Tenant Signature","x":100,"y":700},{"type":"SIGNATURE","label":"Landlord Signature","x":350,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Business Partnership Agreement', description: 'Agreement for establishing business partnerships with equity split', creatorId: julia.id, fileUrl: '/uploads/templates/partnership.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Partner 1","x":100,"y":700},{"type":"SIGNATURE","label":"Partner 2","x":350,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Independent Contractor Agreement', description: 'Freelancer/contractor engagement agreement with scope of work', creatorId: kevin.id, fileUrl: '/uploads/templates/contractor.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Contractor Signature","x":100,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Software License Agreement', description: 'End-user license agreement for software products', creatorId: patricia.id, fileUrl: '/uploads/templates/software-license.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Licensee Signature","x":100,"y":700},{"type":"CHECKBOX","label":"Accept Terms","x":100,"y":650}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Confidentiality Agreement', description: 'One-way confidentiality agreement for sensitive projects', creatorId: john.id, fileUrl: '/uploads/templates/confidentiality.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Recipient Signature","x":100,"y":700}]}'), isPublic: false } }),
      prisma.template.create({ data: { name: 'Non-Compete Agreement', description: 'Non-competition clause agreement for employees', creatorId: jane.id, fileUrl: '/uploads/templates/non-compete.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Employee Signature","x":100,"y":700},{"type":"DATE","label":"Effective Date","x":350,"y":700}]}'), isPublic: false } }),
      prisma.template.create({ data: { name: 'Equipment Rental Agreement', description: 'Short-term equipment rental contract', creatorId: bob.id, fileUrl: '/uploads/templates/equipment-rental.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Renter Signature","x":100,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Consulting Services Agreement', description: 'Professional consulting engagement with milestone deliverables', creatorId: julia.id, fileUrl: '/uploads/templates/consulting.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Consultant Signature","x":100,"y":700},{"type":"SIGNATURE","label":"Client Signature","x":350,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Data Processing Agreement', description: 'GDPR-compliant data processing agreement template', creatorId: kevin.id, fileUrl: '/uploads/templates/dpa.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Controller Signature","x":100,"y":700},{"type":"SIGNATURE","label":"Processor Signature","x":350,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Intellectual Property Assignment', description: 'IP rights assignment and transfer agreement', creatorId: patricia.id, fileUrl: '/uploads/templates/ip-assignment.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Assignor Signature","x":100,"y":700}]}'), isPublic: false } }),
      prisma.template.create({ data: { name: 'Power of Attorney', description: 'Limited power of attorney for specific business transactions', creatorId: admin.id, fileUrl: '/uploads/templates/poa.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Principal Signature","x":100,"y":700},{"type":"SIGNATURE","label":"Witness Signature","x":350,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Terms of Service', description: 'Website/application terms of service agreement', creatorId: demo.id, fileUrl: '/uploads/templates/tos.pdf', fields: JSON.parse('{"fields":[{"type":"CHECKBOX","label":"Accept Terms","x":100,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Privacy Policy Acceptance', description: 'Privacy policy acknowledgement and acceptance form', creatorId: demo.id, fileUrl: '/uploads/templates/privacy-policy.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"User Signature","x":100,"y":700},{"type":"DATE","label":"Date","x":350,"y":700}]}'), isPublic: true } }),
      prisma.template.create({ data: { name: 'Warranty Agreement', description: 'Product warranty terms and conditions agreement', creatorId: john.id, fileUrl: '/uploads/templates/warranty.pdf', fields: JSON.parse('{"fields":[{"type":"SIGNATURE","label":"Customer Signature","x":100,"y":700}]}'), isPublic: true } }),
    ]);
    console.log(`Created ${templates.length} templates`);

    // ==================== AI ANALYSIS (15) ====================
    const aiAnalysisData = documents.slice(0, 15).map((doc) => ({
      documentId: doc.id,
      summary: `AI analysis summary for "${doc.title}". This document has been analyzed for compliance, risk factors, and completeness.`,
      riskAnalysis: { overallRisk: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)], factors: ['Missing indemnification clause', 'Ambiguous termination terms', 'Standard liability provisions'] },
      suggestions: { improvements: ['Add force majeure clause', 'Clarify payment terms', 'Include dispute resolution mechanism'] },
      compliance: { gdprCompliant: true, hipaaCompliant: false, socCompliant: true },
    }));
    await prisma.aIAnalysis.createMany({ data: aiAnalysisData });
    console.log(`Created ${aiAnalysisData.length} AI analyses`);

    // ==================== AUDIT LOGS (25) ====================
    const auditActions = [
      'DOCUMENT_CREATED', 'DOCUMENT_VIEWED', 'DOCUMENT_UPDATED', 'DOCUMENT_SENT',
      'DOCUMENT_SIGNED', 'DOCUMENT_DELETED', 'USER_LOGIN', 'USER_LOGOUT',
      'USER_REGISTERED', 'PASSWORD_CHANGED', 'TEMPLATE_CREATED', 'TEMPLATE_UPDATED',
      'TEMPLATE_DELETED', 'AI_ANALYSIS_RUN', 'BULK_DELETE',
    ];

    const auditLogData = [];
    for (let i = 0; i < 25; i++) {
      const action = auditActions[i % auditActions.length];
      const user = users[i % users.length];
      const doc = documents[i % documents.length];
      auditLogData.push({
        documentId: action.startsWith('DOCUMENT') || action.startsWith('AI') ? doc.id : null,
        userId: user.id,
        action,
        details: { description: `${action} performed by ${user.firstName} ${user.lastName}`, timestamp: new Date(Date.now() - i * 3600000).toISOString() },
        ipAddress: `192.168.${Math.floor(i / 10)}.${(i % 254) + 1}`,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      });
    }
    await prisma.auditLog.createMany({ data: auditLogData });
    console.log(`Created ${auditLogData.length} audit logs`);

    console.log('\n=== Seed Data Summary ===');
    console.log(`Users: ${users.length}`);
    console.log(`Documents: ${documents.length}`);
    console.log(`Document Fields: ${fieldData.length}`);
    console.log(`Signatures: ${signatureData.length}`);
    console.log(`Templates: ${templates.length}`);
    console.log(`AI Analyses: ${aiAnalysisData.length}`);
    console.log(`Audit Logs: ${auditLogData.length}`);
    console.log('\nDefault login: demo@example.com / password123');
    console.log('Admin login: admin@docusign.com / password123');
    console.log('\nSeed data created successfully!');
  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();
