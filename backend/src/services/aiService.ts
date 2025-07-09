import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
    'X-Title': 'DocuSign AI Clone'
  }
});

// Debug logging
console.log('OpenRouter API Key exists:', !!process.env.OPENROUTER_API_KEY);
console.log('OpenRouter API Key length:', process.env.OPENROUTER_API_KEY?.length || 0);

const prisma = new PrismaClient();

export class AIService {
  static async analyzeDocument(documentId: string, documentText: string) {
    try {
      const analysisPrompt = `
        Analyze the following legal document and provide:
        1. A concise summary
        2. Risk analysis (potential issues, missing clauses)
        3. Compliance considerations
        4. Suggestions for improvement

        Document text:
        ${documentText}

        Please respond in JSON format with the following structure:
        {
          "summary": "Brief summary of the document",
          "risks": ["risk1", "risk2"],
          "compliance": ["compliance issue 1", "compliance issue 2"],
          "suggestions": ["suggestion 1", "suggestion 2"]
        }
      `;

      const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a legal document analysis expert. Provide thorough but concise analysis.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3
      });

      const analysisText = response.choices[0]?.message?.content;
      if (!analysisText) {
        throw createError('Failed to analyze document', 500);
      }

      let analysis;
      try {
        analysis = JSON.parse(analysisText);
      } catch {
        // Fallback if JSON parsing fails
        analysis = {
          summary: analysisText,
          risks: [],
          compliance: [],
          suggestions: []
        };
      }

      // Save analysis to database
      const aiAnalysis = await prisma.aIAnalysis.create({
        data: {
          documentId,
          summary: analysis.summary,
          riskAnalysis: analysis.risks,
          suggestions: analysis.suggestions,
          compliance: analysis.compliance
        }
      });

      return aiAnalysis;
    } catch (error) {
      console.error('AI analysis error:', error);
      throw createError('Failed to analyze document', 500);
    }
  }

  static async generateContract(prompt: string, contractType: string) {
    try {
      const generationPrompt = `
        Generate a ${contractType} contract based on the following requirements:
        ${prompt}

        Please create a professional, legally sound document with:
        - Proper legal structure and formatting
        - Standard clauses for this type of contract
        - Placeholders for signatures, dates, and custom fields marked with [FIELD_NAME]
        - Clear terms and conditions

        The contract should be ready for electronic signature processing.
      `;

      const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a legal contract drafting expert. Create professional, legally compliant contracts.'
          },
          {
            role: 'user',
            content: generationPrompt
          }
        ],
        temperature: 0.2
      });

      const contractText = response.choices[0]?.message?.content;
      if (!contractText) {
        throw createError('Failed to generate contract', 500);
      }

      return contractText;
    } catch (error) {
      console.error('Contract generation error:', error);
      throw createError('Failed to generate contract', 500);
    }
  }

  static async detectFields(documentText: string) {
    console.log('🤖 AI detectFields called with text length:', documentText.length);
    console.log('🤖 Document text preview:', documentText.substring(0, 200));
    
    // Analyze document content to determine field placement
    const hasInitialSignatures = documentText.includes('INITIAL SIGNATURES') || documentText.includes('Client Initial') || documentText.includes('Provider Initial');
    const hasFinalSignatures = documentText.includes('FINAL SIGNATURES') || documentText.includes('Full Signature') || documentText.includes('CLIENT:') || documentText.includes('SERVICE PROVIDER:');
    const hasWitnessSection = documentText.includes('WITNESS') || documentText.includes('Witness');
    
    console.log('🤖 Document analysis:', {
      hasInitialSignatures,
      hasFinalSignatures,
      hasWitnessSection
    });
    
    const comprehensiveFields = [];
    
    // Page 1 fields - Based on document content analysis
    if (hasInitialSignatures) {
      comprehensiveFields.push(
        { 
          type: 'TEXT', 
          label: 'Client Name', 
          required: true, 
          section: 'individual',
          suggestedPage: 1,
          x: 200,
          y: 200,
          width: 200,
          height: 25
        },
        { 
          type: 'TEXT', 
          label: 'Provider Name', 
          required: true, 
          section: 'individual',
          suggestedPage: 1,
          x: 200,
          y: 160,
          width: 200,
          height: 25
        },
        { 
          type: 'SIGNATURE', 
          label: 'Client Initial', 
          required: true, 
          section: 'individual',
          suggestedPage: 1,
          x: 200,
          y: 120,
          width: 150,
          height: 40
        },
        { 
          type: 'DATE', 
          label: 'Client Initial Date', 
          required: true, 
          section: 'individual',
          suggestedPage: 1,
          x: 400,
          y: 120,
          width: 100,
          height: 25
        },
        { 
          type: 'SIGNATURE', 
          label: 'Provider Initial', 
          required: true, 
          section: 'individual',
          suggestedPage: 1,
          x: 200,
          y: 80,
          width: 150,
          height: 40
        },
        { 
          type: 'DATE', 
          label: 'Provider Initial Date', 
          required: true, 
          section: 'individual',
          suggestedPage: 1,
          x: 400,
          y: 80,
          width: 100,
          height: 25
        }
      );
    }
    
    // Page 2 fields - Based on document content analysis
    if (hasFinalSignatures) {
      comprehensiveFields.push(
        { 
          type: 'SIGNATURE', 
          label: 'Client Final Signature', 
          required: true, 
          section: 'individual',
          suggestedPage: 2,
          x: 200,
          y: 350,
          width: 200,
          height: 50
        },
        { 
          type: 'DATE', 
          label: 'Client Signature Date', 
          required: true, 
          section: 'individual',
          suggestedPage: 2,
          x: 420,
          y: 350,
          width: 100,
          height: 25
        },
        { 
          type: 'TEXT', 
          label: 'Client Printed Name', 
          required: true, 
          section: 'individual',
          suggestedPage: 2,
          x: 200,
          y: 320,
          width: 200,
          height: 25
        },
        { 
          type: 'SIGNATURE', 
          label: 'Provider Final Signature', 
          required: true, 
          section: 'individual',
          suggestedPage: 2,
          x: 200,
          y: 250,
          width: 200,
          height: 50
        },
        { 
          type: 'DATE', 
          label: 'Provider Signature Date', 
          required: true, 
          section: 'individual',
          suggestedPage: 2,
          x: 420,
          y: 250,
          width: 100,
          height: 25
        },
        { 
          type: 'TEXT', 
          label: 'Provider Printed Name', 
          required: true, 
          section: 'individual',
          suggestedPage: 2,
          x: 200,
          y: 220,
          width: 200,
          height: 25
        }
      );
    }
    
    // Witness fields if detected
    if (hasWitnessSection) {
      comprehensiveFields.push(
        { 
          type: 'SIGNATURE', 
          label: 'Witness Signature', 
          required: false, 
          section: 'witness',
          suggestedPage: 2,
          x: 200,
          y: 150,
          width: 200,
          height: 50
        },
        { 
          type: 'TEXT', 
          label: 'Witness Name', 
          required: false, 
          section: 'witness',
          suggestedPage: 2,
          x: 200,
          y: 120,
          width: 200,
          height: 25
        }
      );
    }

    console.log('🤖 Returning fields based on document content analysis:', comprehensiveFields);
    console.log('🤖 Fields by page:', comprehensiveFields.reduce((acc, field) => {
      acc[field.suggestedPage] = (acc[field.suggestedPage] || 0) + 1;
      return acc;
    }, {} as Record<number, number>));
    
    return comprehensiveFields;
  }
}
