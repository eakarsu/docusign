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
    // Check if API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not found in environment variables');
      throw createError('OpenRouter API key not configured', 500);
    }

    try {
      const fieldDetectionPrompt = `
        Analyze the following legal document text and identify ALL signature fields, witness fields, date fields, and text input fields.

        Pay special attention to:
        - Individual signature sections (recipient signatures)
        - Company signature sections (director signatures) 
        - Witness signature fields
        - Witness name fields
        - Witness address fields
        - Date fields
        - Any blank lines or underscores that indicate input areas

        Document text:
        ${documentText}

        Please respond in JSON format with a comprehensive array of ALL suggested fields:
        {
          "fields": [
            {
              "type": "SIGNATURE|DATE|TEXT|INITIAL",
              "label": "Field label (be specific, e.g., 'Recipient Signature', 'Witness Name', 'Witness Address')",
              "required": true|false,
              "suggestedPosition": "description of where this field should be placed",
              "section": "individual|company|witness"
            }
          ]
        }

        Make sure to include fields for:
        1. Main signatures (recipient/director)
        2. Witness signatures  
        3. Witness names
        4. Witness addresses
        5. Date fields
        6. Any other input areas marked with underscores or blank spaces
      `;

      const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a legal document processing expert. Identify ALL signature and input fields in legal documents, especially witness-related fields.'
          },
          {
            role: 'user',
            content: fieldDetectionPrompt
          }
        ],
        temperature: 0.1
      });

      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        // Fallback with comprehensive legal document fields
        return [
          // Individual section signatures
          { type: 'SIGNATURE', label: 'Recipient Signature', required: true, section: 'individual', suggestedPage: 1 },
          { type: 'SIGNATURE', label: 'Individual Witness Signature', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'TEXT', label: 'Individual Witness Name', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'TEXT', label: 'Individual Witness Address', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'DATE', label: 'Individual Signature Date', required: true, section: 'individual', suggestedPage: 1 },
          
          // Company section signatures
          { type: 'SIGNATURE', label: 'Director Signature', required: true, section: 'company', suggestedPage: 1 },
          { type: 'SIGNATURE', label: 'Company Witness Signature', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'TEXT', label: 'Company Witness Name', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'TEXT', label: 'Company Witness Address', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'DATE', label: 'Company Signature Date', required: true, section: 'company', suggestedPage: 1 },
        ];
      }

      let fieldSuggestions;
      try {
        fieldSuggestions = JSON.parse(responseText);
      } catch {
        // Fallback with enhanced field detection
        return [
          // Individual section signatures
          { type: 'SIGNATURE', label: 'Recipient Signature', required: true, section: 'individual', suggestedPage: 1 },
          { type: 'SIGNATURE', label: 'Individual Witness Signature', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'TEXT', label: 'Individual Witness Name', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'TEXT', label: 'Individual Witness Address', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'DATE', label: 'Individual Signature Date', required: true, section: 'individual', suggestedPage: 1 },
          
          // Company section signatures
          { type: 'SIGNATURE', label: 'Director Signature', required: true, section: 'company', suggestedPage: 1 },
          { type: 'SIGNATURE', label: 'Company Witness Signature', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'TEXT', label: 'Company Witness Name', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'TEXT', label: 'Company Witness Address', required: true, section: 'witness', suggestedPage: 1 },
          { type: 'DATE', label: 'Company Signature Date', required: true, section: 'company', suggestedPage: 1 },
        ];
      }

      return fieldSuggestions.fields || [];
    } catch (error) {
      console.error('Field detection error:', error);
      // Return comprehensive fallback fields for legal documents
      return [
        // Individual section signatures
        { type: 'SIGNATURE', label: 'Recipient Signature', required: true, section: 'individual', suggestedPage: 1 },
        { type: 'SIGNATURE', label: 'Individual Witness Signature', required: true, section: 'witness', suggestedPage: 1 },
        { type: 'TEXT', label: 'Individual Witness Name', required: true, section: 'witness', suggestedPage: 1 },
        { type: 'TEXT', label: 'Individual Witness Address', required: true, section: 'witness', suggestedPage: 1 },
        { type: 'DATE', label: 'Individual Signature Date', required: true, section: 'individual', suggestedPage: 1 },
        
        // Company section signatures
        { type: 'SIGNATURE', label: 'Director Signature', required: true, section: 'company', suggestedPage: 1 },
        { type: 'SIGNATURE', label: 'Company Witness Signature', required: true, section: 'witness', suggestedPage: 1 },
        { type: 'TEXT', label: 'Company Witness Name', required: true, section: 'witness', suggestedPage: 1 },
        { type: 'TEXT', label: 'Company Witness Address', required: true, section: 'witness', suggestedPage: 1 },
        { type: 'DATE', label: 'Company Signature Date', required: true, section: 'company', suggestedPage: 1 },
      ];
    }
  }
}
