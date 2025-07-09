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

  static async detectSignatureOverlays(documentText: string) {
    console.log('🤖 AI detectSignatureOverlays called with text length:', documentText.length);
    console.log('🤖 Document text preview:', documentText.substring(0, 200));
    
    try {
      // Use AI to identify signature locations and generate overlay instructions
      const prompt = `
        Analyze this legal document and identify ALL signature locations where someone needs to sign.
        
        Document content:
        ${documentText}
        
        For each signature location, provide:
        1. The exact text that indicates a signature is needed
        2. Which page it appears on
        3. A descriptive label for what type of signature it is
        
        Please return a JSON array with this structure:
        [
          {
            "signatureText": "exact text from document like 'Signature: _______' or 'Client Initial: _______'",
            "page": 1 or 2,
            "label": "descriptive name like 'Client Signature' or 'Witness Initial'",
            "type": "SIGNATURE" | "INITIAL",
            "required": true/false
          }
        ]
        
        Look for these patterns:
        - "Signature:" followed by underscores or lines
        - "Initial:" followed by underscores or lines  
        - "Sign:" or "Signed:" patterns
        - Any underscores that indicate signature placement
        - "Witness" signature areas
        - "Director" signature areas
        
        Return only the JSON array, no other text.
      `;

      console.log('🤖 Making OpenRouter API call for signature overlay detection...');
      
      const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing legal documents and finding signature locations. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });

      console.log('🤖 OpenRouter API response received');
      
      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI');
      }

      console.log('🤖 AI Response:', aiResponse);

      // Parse the AI response
      let signatureLocations;
      try {
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
        signatureLocations = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('🤖 Failed to parse AI response as JSON:', parseError);
        throw new Error('Invalid AI response format');
      }

      if (!Array.isArray(signatureLocations)) {
        throw new Error('AI response is not an array');
      }

      console.log('🤖 Parsed signature locations:', signatureLocations);
      
      // Convert to overlay format
      const overlays = signatureLocations.map((location: any, index: number) => ({
        id: `overlay-${Date.now()}-${index}`,
        type: location.type || 'SIGNATURE',
        label: location.label || `Signature ${index + 1}`,
        page: location.page || 1,
        signatureText: location.signatureText || '',
        required: location.required !== false,
        overlayType: 'CLICK_TO_SIGN'
      }));

      console.log('🤖 Generated signature overlays:', overlays);
      return overlays;

    } catch (error) {
      console.error('🤖 AI signature overlay detection failed, using fallback:', error);
      
      // Fallback to rule-based signature overlay detection
      const overlays = [];
      
      // Look for signature patterns in the text
      const signaturePatterns = [
        { pattern: /Client Initial:.*?_+/gi, label: 'Client Initial', page: 1, type: 'INITIAL' },
        { pattern: /Provider Initial:.*?_+/gi, label: 'Provider Initial', page: 1, type: 'INITIAL' },
        { pattern: /Full Signature:.*?_+/gi, label: 'Client Final Signature', page: 2, type: 'SIGNATURE' },
        { pattern: /Signature:.*?_+/gi, label: 'Signature', page: 2, type: 'SIGNATURE' },
        { pattern: /Witness.*?Signature:.*?_+/gi, label: 'Witness Signature', page: 2, type: 'SIGNATURE' },
        { pattern: /Director.*?Signature:.*?_+/gi, label: 'Director Signature', page: 2, type: 'SIGNATURE' }
      ];
      
      signaturePatterns.forEach((pattern, index) => {
        const matches = documentText.match(pattern.pattern);
        if (matches) {
          matches.forEach((match, matchIndex) => {
            overlays.push({
              id: `fallback-overlay-${index}-${matchIndex}`,
              type: pattern.type,
              label: pattern.label,
              page: pattern.page,
              signatureText: match.trim(),
              required: true,
              overlayType: 'CLICK_TO_SIGN'
            });
          });
        }
      });
      
      // If no patterns found, create basic overlays
      if (overlays.length === 0) {
        overlays.push(
          {
            id: 'fallback-overlay-1',
            type: 'INITIAL',
            label: 'Client Initial',
            page: 1,
            signatureText: 'Client Initial: _________________________',
            required: true,
            overlayType: 'CLICK_TO_SIGN'
          },
          {
            id: 'fallback-overlay-2',
            type: 'INITIAL',
            label: 'Provider Initial',
            page: 1,
            signatureText: 'Provider Initial: _______________________',
            required: true,
            overlayType: 'CLICK_TO_SIGN'
          },
          {
            id: 'fallback-overlay-3',
            type: 'SIGNATURE',
            label: 'Client Final Signature',
            page: 2,
            signatureText: 'Full Signature: _________________________',
            required: true,
            overlayType: 'CLICK_TO_SIGN'
          },
          {
            id: 'fallback-overlay-4',
            type: 'SIGNATURE',
            label: 'Provider Final Signature',
            page: 2,
            signatureText: 'Full Signature: _________________________',
            required: true,
            overlayType: 'CLICK_TO_SIGN'
          },
          {
            id: 'fallback-overlay-5',
            type: 'SIGNATURE',
            label: 'Witness Signature',
            page: 2,
            signatureText: 'Signature: _________________________',
            required: false,
            overlayType: 'CLICK_TO_SIGN'
          }
        );
      }

      console.log('🤖 Returning fallback signature overlays:', overlays);
      return overlays;
    }
  }
}
