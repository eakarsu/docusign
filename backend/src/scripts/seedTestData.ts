import { PrismaClient } from '@prisma/client';
import { createTestDocument } from '../utils/createTestDocument';

const prisma = new PrismaClient();

async function seedTestData() {
  try {
    // Create test document file
    const fileUrl = await createTestDocument();
    
    // Create a test user if doesn't exist
    let testUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: '$2b$10$dummy.hash.for.test.user', // In real app, hash properly
          role: 'USER' as any
        }
      });
    }

    // Create test document
    const existingDoc = await prisma.document.findFirst({
      where: { title: 'Sample Service Agreement' }
    });

    if (!existingDoc) {
      await prisma.document.create({
        data: {
          title: 'Sample Service Agreement',
          description: 'A sample service agreement document for testing',
          originalFileName: 'sample-service-agreement.pdf',
          fileUrl,
          fileSize: 50000, // Approximate size
          mimeType: 'application/pdf',
          senderId: testUser.id,
          status: 'DRAFT'
        }
      });
    }

    console.log('Test data seeded successfully!');
  } catch (error) {
    console.error('Error seeding test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();
