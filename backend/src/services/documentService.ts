import { PrismaClient } from '@prisma/client';
import { S3Service } from './s3Service';
import { createError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export class DocumentService {
  static async uploadDocument(
    file: Express.Multer.File,
    userId: string,
    title: string,
    description?: string
  ) {
    const fileKey = `documents/${uuidv4()}-${file.originalname}`;
    const fileUrl = await S3Service.uploadFile(file, fileKey);

    const document = await prisma.document.create({
      data: {
        title,
        description,
        originalFileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        senderId: userId
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return document;
  }

  static async getDocuments(userId: string, role: string) {
    const where = role === 'ADMIN' ? {} : { senderId: userId };

    const documents = await prisma.document.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        signatures: {
          select: {
            id: true,
            status: true,
            signerEmail: true,
            signerName: true,
            signedAt: true
          }
        },
        _count: {
          select: {
            signatures: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return documents;
  }

  static async getDocument(documentId: string, userId: string, role: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        fields: true,
        signatures: {
          include: {
            signer: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        aiAnalysis: true
      }
    });

    if (!document) {
      throw createError('Document not found', 404);
    }

    // Check permissions
    if (role !== 'ADMIN' && document.senderId !== userId) {
      // Check if user is a signer
      const isSignerOrViewer = document.signatures.some(
        sig => sig.signer.id === userId
      );
      
      if (!isSignerOrViewer) {
        throw createError('Access denied', 403);
      }
    }

    return document;
  }

  static async addFields(documentId: string, fields: any[], userId: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      throw createError('Document not found', 404);
    }

    if (document.senderId !== userId) {
      throw createError('Access denied', 403);
    }

    // Delete existing fields
    await prisma.documentField.deleteMany({
      where: { documentId }
    });

    // Create new fields
    const createdFields = await prisma.documentField.createMany({
      data: fields.map(field => ({
        ...field,
        documentId
      }))
    });

    return createdFields;
  }

  static async sendDocument(
    documentId: string,
    signers: Array<{ email: string; name: string }>,
    userId: string
  ) {
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      throw createError('Document not found', 404);
    }

    if (document.senderId !== userId) {
      throw createError('Access denied', 403);
    }

    // Create signature records
    const signatures = await Promise.all(
      signers.map(async (signer) => {
        // Find or create user
        let user = await prisma.user.findUnique({
          where: { email: signer.email }
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: signer.email,
              firstName: signer.name.split(' ')[0] || '',
              lastName: signer.name.split(' ').slice(1).join(' ') || '',
              password: '', // Temporary password, user will set on first login
              role: 'SIGNER'
            }
          });
        }

        return prisma.signature.create({
          data: {
            documentId,
            signerId: user.id,
            signerEmail: signer.email,
            signerName: signer.name
          }
        });
      })
    );

    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'SENT' }
    });

    // TODO: Send email notifications to signers

    return signatures;
  }

  static async signDocument(
    documentId: string,
    signatureData: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const signature = await prisma.signature.findFirst({
      where: {
        documentId,
        signerId: userId,
        status: 'PENDING'
      }
    });

    if (!signature) {
      throw createError('Signature not found or already completed', 404);
    }

    const updatedSignature = await prisma.signature.update({
      where: { id: signature.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData,
        ipAddress,
        userAgent
      }
    });

    // Check if all signatures are complete
    const allSignatures = await prisma.signature.findMany({
      where: { documentId }
    });

    const allSigned = allSignatures.every(sig => sig.status === 'SIGNED');

    if (allSigned) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
    }

    return updatedSignature;
  }
}
