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
    
    try {
      // Use actual AI to detect signature fields
      const prompt = `
        Analyze this legal document and identify all signature fields, date fields, and text input fields.
        
        Document content:
        ${documentText}
        
        Please return a JSON array of field objects with the following structure:
        [
          {
            "type": "SIGNATURE" | "DATE" | "TEXT",
            "label": "descriptive label",
            "required": true/false,
            "section": "individual" | "witness" | "general",
            "suggestedPage": 1 or 2,
            "x": estimated x position (0-600),
            "y": estimated y position (0-800),
            "width": field width,
            "height": field height
          }
        ]
        
        Focus on finding:
        - Signature lines (look for "Signature:", "Sign:", underscores, signature blocks)
        - Date fields (look for "Date:", date lines)
        - Name fields (look for "Name:", "Print Name:")
        - Initial fields (look for "Initial:")
        
        Return only the JSON array, no other text.
      `;

      console.log('🤖 Making OpenRouter API call...');
      
      const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing legal documents and identifying signature fields. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      console.log('🤖 OpenRouter API response received');
      
      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI');
      }

      console.log('🤖 AI Response:', aiResponse);

      // Parse the AI response
      let aiFields;
      try {
        // Clean the response to extract JSON
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
        aiFields = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('🤖 Failed to parse AI response as JSON:', parseError);
        throw new Error('Invalid AI response format');
      }

      if (!Array.isArray(aiFields)) {
        throw new Error('AI response is not an array');
      }

      console.log('🤖 Parsed AI fields:', aiFields);
      
      // Validate and normalize the fields
      const normalizedFields = aiFields.map((field: any, index: number) => ({
        type: field.type || 'SIGNATURE',
        label: field.label || `Field ${index + 1}`,
        required: field.required !== false,
        section: field.section || 'individual',
        suggestedPage: field.suggestedPage || (field.type === 'SIGNATURE' ? 2 : 1),
        x: Math.max(50, Math.min(field.x || 200, 500)),
        y: Math.max(50, Math.min(field.y || 200, 700)),
        width: field.width || (field.type === 'SIGNATURE' ? 200 : 150),
        height: field.height || (field.type === 'SIGNATURE' ? 50 : 25)
      }));

      console.log('🤖 Normalized AI fields:', normalizedFields);
      return normalizedFields;

    } catch (error) {
      console.error('🤖 AI field detection failed, using fallback:', error);
      
      // Fallback to rule-based detection if AI fails
      const hasInitialSignatures = documentText.includes('INITIAL SIGNATURES') || documentText.includes('Client Initial') || documentText.includes('Provider Initial');
      const hasFinalSignatures = documentText.includes('FINAL SIGNATURES') || documentText.includes('Full Signature') || documentText.includes('CLIENT:') || documentText.includes('SERVICE PROVIDER:');
      const hasWitnessSection = documentText.includes('WITNESS') || documentText.includes('Witness');
      
      console.log('🤖 Fallback document analysis:', {
        hasInitialSignatures,
        hasFinalSignatures,
        hasWitnessSection
      });
      
      const fallbackFields = [];
      
      // Page 1 fields - Based on document content analysis
      if (hasInitialSignatures) {
        fallbackFields.push(
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
            type: 'SIGNATURE', 
            label: 'Provider Initial', 
            required: true, 
            section: 'individual',
            suggestedPage: 1,
            x: 200,
            y: 80,
            width: 150,
            height: 40
          }
        );
      }
      
      // Page 2 fields - Based on document content analysis
      if (hasFinalSignatures) {
        fallbackFields.push(
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
            type: 'SIGNATURE', 
            label: 'Provider Final Signature', 
            required: true, 
            section: 'individual',
            suggestedPage: 2,
            x: 200,
            y: 250,
            width: 200,
            height: 50
          }
        );
      }
      
      // Witness fields if detected
      if (hasWitnessSection) {
        fallbackFields.push(
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
          }
        );
      }

      console.log('🤖 Returning fallback fields:', fallbackFields);
      return fallbackFields;
    }
  }
}
