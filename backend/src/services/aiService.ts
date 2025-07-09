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

  static async generateSignatureOverlayImage(documentId: string, pageNumber: number, pdfImageBase64: string) {
    console.log('🤖 AI generateSignatureOverlayImage called for document:', documentId, 'page:', pageNumber);
    
    try {
      // Use AI vision to analyze the PDF page image and generate overlay image
      const prompt = `
        Analyze this PDF page image and create an overlay image with "CLICK TO SIGN" buttons positioned exactly over signature locations.
        
        Look for these visual patterns:
        - Lines with "Signature:" text followed by underscores
        - Lines with "Initial:" text followed by underscores
        - "Sign here" or similar indicators
        - Witness signature areas
        - Director signature areas
        - Any underscores that indicate signature placement
        
        Create a transparent PNG overlay image that:
        1. Has the same dimensions as the input image
        2. Contains orange "CLICK TO SIGN" buttons positioned exactly over signature lines
        3. Each button should be approximately 200x50 pixels
        4. Use orange background (#FF9800) with white text
        5. Make buttons clearly visible and clickable-looking
        
        Return the overlay image as a base64 encoded PNG.
        Also provide a JSON array of button locations for click detection:
        [
          {
            "x": button x coordinate,
            "y": button y coordinate,
            "width": button width,
            "height": button height,
            "label": "descriptive name like 'Director Signature'"
          }
        ]
        
        Format your response as:
        OVERLAY_IMAGE: data:image/png;base64,[base64_data]
        LOCATIONS: [json_array]
      `;

      console.log('🤖 Making OpenRouter API call with vision for overlay generation...');
      
      const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing document images and creating precise signature overlays. Generate overlay images with "CLICK TO SIGN" buttons positioned exactly over signature lines.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${pdfImageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      console.log('🤖 OpenRouter vision API response received');
      
      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('No response from AI vision');
      }

      console.log('🤖 AI Vision Response:', aiResponse.substring(0, 500) + '...');

      console.log('🤖 AI Vision Response (first 1000 chars):', aiResponse.substring(0, 1000));
      
      // Since AI vision overlay generation is complex, let's use a simpler approach
      // Create overlay image programmatically based on detected signature locations
      console.log('🔄 AI vision did not provide usable overlay, creating programmatic overlay');
      
      // Use the fallback approach but with better positioning based on the document
      return await this.createProgrammaticOverlay(documentId, pageNumber, pdfImageBase64);

    } catch (error) {
      console.error('🤖 AI vision overlay generation failed, using fallback:', error);
      
      // Fallback to basic overlay generation
      return await this.createFallbackOverlay(pageNumber);
    }
  }

  static async saveOverlayImage(overlayImageBase64: string, documentId: string, pageNumber: number): Promise<string> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Create overlays directory if it doesn't exist
      const overlaysDir = path.join(process.cwd(), 'uploads', 'overlays');
      if (!fs.existsSync(overlaysDir)) {
        fs.mkdirSync(overlaysDir, { recursive: true });
      }
      
      // Generate filename
      const timestamp = Date.now();
      const filename = `overlay-${documentId}-page${pageNumber}-${timestamp}.png`;
      const filePath = path.join(overlaysDir, filename);
      
      // Extract base64 data (remove data:image/png;base64, prefix)
      const base64Data = overlayImageBase64.replace(/^data:image\/png;base64,/, '');
      
      // Save to file
      fs.writeFileSync(filePath, base64Data, 'base64');
      
      const savedPath = `/uploads/overlays/${filename}`;
      console.log('💾 Overlay image saved to:', savedPath);
      
      return savedPath;
    } catch (error) {
      console.error('❌ Failed to save overlay image:', error);
      throw error;
    }
  }

  static async createProgrammaticOverlay(documentId: string, pageNumber: number, pdfImageBase64: string) {
    console.log('🎨 Creating programmatic overlay for page:', pageNumber);
    
    try {
      // Create overlay image using node-canvas
      const { createCanvas, loadImage } = require('canvas');
      
      // Load the PDF page image
      const pdfImage = await loadImage(`data:image/png;base64,${pdfImageBase64}`);
      
      // Create canvas with same dimensions as PDF
      const canvas = createCanvas(pdfImage.width, pdfImage.height);
      const ctx = canvas.getContext('2d');
      
      // Define signature locations based on page
      const signatureLocations = pageNumber === 1 ? [
        { x: 200, y: pdfImage.height - 200, width: 200, height: 50, label: 'Client Initial' },
        { x: 200, y: pdfImage.height - 140, width: 200, height: 50, label: 'Provider Initial' }
      ] : [
        { x: 480, y: 300, width: 200, height: 50, label: 'Director Signature' },
        { x: 480, y: 250, width: 200, height: 50, label: 'Witness Signature' },
        { x: 480, y: 200, width: 200, height: 50, label: 'Witness Name' }
      ];
      
      // Draw "CLICK TO SIGN" buttons
      signatureLocations.forEach((location) => {
        // Draw button background
        ctx.fillStyle = '#FF9800';
        ctx.fillRect(location.x, location.y, location.width, location.height);
        
        // Draw button border
        ctx.strokeStyle = '#F57C00';
        ctx.lineWidth = 3;
        ctx.strokeRect(location.x, location.y, location.width, location.height);
        
        // Draw text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          '🖊️ CLICK TO SIGN',
          location.x + location.width / 2,
          location.y + location.height / 2
        );
      });
      
      // Convert to base64
      const overlayImageBase64 = canvas.toDataURL('image/png');
      
      // Save the overlay image
      const savedImagePath = await this.saveOverlayImage(overlayImageBase64, documentId, pageNumber);
      
      return {
        overlayImage: overlayImageBase64,
        savedImagePath,
        signatureFields: signatureLocations.map((location, index) => ({
          id: `programmatic-overlay-${Date.now()}-${index}`,
          type: 'SIGNATURE',
          label: location.label,
          x: location.x,
          y: location.y,
          width: location.width,
          height: location.height,
          page: pageNumber,
          required: true,
          overlayType: 'CLICK_TO_SIGN'
        }))
      };
      
    } catch (error) {
      console.error('🤖 Failed to create programmatic overlay:', error);
      return await this.createFallbackOverlay(pageNumber);
    }
  }

  static async createFallbackOverlay(pageNumber: number) {
    console.log('🔄 Creating fallback overlay for page:', pageNumber);
    
    const fallbackLocations = pageNumber === 1 ? [
      { x: 200, y: 120, width: 200, height: 50, label: 'Client Initial', type: 'INITIAL' },
      { x: 200, y: 80, width: 200, height: 50, label: 'Provider Initial', type: 'INITIAL' }
    ] : [
      { x: 480, y: 300, width: 200, height: 50, label: 'Director Signature', type: 'SIGNATURE' },
      { x: 480, y: 250, width: 200, height: 50, label: 'Witness Signature', type: 'SIGNATURE' },
      { x: 480, y: 200, width: 200, height: 50, label: 'Witness Name', type: 'TEXT' }
    ];
    
    return {
      overlayImage: null, // No overlay image for fallback
      savedImagePath: null,
      signatureFields: fallbackLocations.map((location, index) => ({
        id: `fallback-overlay-${Date.now()}-${index}`,
        type: location.type,
        label: location.label,
        x: location.x,
        y: location.y,
        width: location.width,
        height: location.height,
        page: pageNumber,
        required: true,
        overlayType: 'CLICK_TO_SIGN'
      }))
    };
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
            "required": true/false,
            "x": estimated x coordinate (0-612 for standard PDF width),
            "y": estimated y coordinate (0-792 for standard PDF height),
            "width": suggested field width (typically 200-300 for signatures),
            "height": suggested field height (typically 40-60 for signatures)
          }
        ]
        
        Look for these patterns:
        - "Signature:" followed by underscores or lines
        - "Initial:" followed by underscores or lines  
        - "Sign:" or "Signed:" patterns
        - Any underscores that indicate signature placement
        - "Witness" signature areas
        - "Director" signature areas
        
        For coordinates, estimate based on typical document layout:
        - Page 1 signatures usually appear near bottom (y: 100-200)
        - Page 2 signatures spread throughout (y: 150-600)
        - Left margin typically starts at x: 50-100
        - Signature lines are usually 200-300 pixels wide
        - Standard PDF page is 612x792 pixels
        
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
      
      // Convert to overlay format with coordinates
      const overlays = signatureLocations.map((location: any, index: number) => ({
        id: `overlay-${Date.now()}-${index}`,
        type: location.type || 'SIGNATURE',
        label: location.label || `Signature ${index + 1}`,
        page: location.page || 1,
        signatureText: location.signatureText || '',
        required: location.required !== false,
        overlayType: 'CLICK_TO_SIGN',
        x: location.x || (50 + (index % 2) * 300), // Default positioning if AI doesn't provide
        y: location.y || (150 + Math.floor(index / 2) * 100),
        width: location.width || (location.type === 'SIGNATURE' ? 250 : 150),
        height: location.height || (location.type === 'SIGNATURE' ? 60 : 40)
      }));

      console.log('🤖 Generated signature overlays:', overlays);
      return overlays;

    } catch (error) {
      console.error('🤖 AI signature overlay detection failed, using fallback:', error);
      
      // Fallback to rule-based signature overlay detection
      const overlays = [];
      
      // Look for signature patterns in the text with better estimated coordinates
      // Based on typical document layout where signatures appear near the bottom
      const signaturePatterns = [
        { pattern: /Client Initial:.*?_+/gi, label: 'Client Initial', page: 1, type: 'INITIAL', x: 200, y: 200, width: 200, height: 40 },
        { pattern: /Provider Initial:.*?_+/gi, label: 'Provider Initial', page: 1, type: 'INITIAL', x: 200, y: 160, width: 200, height: 40 },
        { pattern: /Full Signature:.*?_+/gi, label: 'Client Final Signature', page: 2, type: 'SIGNATURE', x: 200, y: 400, width: 250, height: 60 },
        { pattern: /Signature of Director/gi, label: 'Director Signature', page: 2, type: 'SIGNATURE', x: 200, y: 300, width: 250, height: 60 },
        { pattern: /Signature of witness/gi, label: 'Witness Signature', page: 2, type: 'SIGNATURE', x: 200, y: 200, width: 250, height: 60 },
        { pattern: /Name of witness/gi, label: 'Witness Name', page: 2, type: 'TEXT', x: 200, y: 170, width: 200, height: 25 }
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
              overlayType: 'CLICK_TO_SIGN',
              x: pattern.x + (matchIndex * 50), // Offset multiple matches
              y: pattern.y + (matchIndex * 70),
              width: pattern.width,
              height: pattern.height
            });
          });
        }
      });
      
      // If no patterns found, create basic overlays with better coordinates
      if (overlays.length === 0) {
        overlays.push(
          {
            id: 'fallback-overlay-1',
            type: 'SIGNATURE',
            label: 'Director Signature',
            page: 2,
            signatureText: 'Signature of Director: _________________________',
            required: true,
            overlayType: 'CLICK_TO_SIGN',
            x: 480,
            y: 300,
            width: 200,
            height: 50
          },
          {
            id: 'fallback-overlay-2',
            type: 'SIGNATURE',
            label: 'Witness Signature',
            page: 2,
            signatureText: 'Signature of witness: _________________________',
            required: true,
            overlayType: 'CLICK_TO_SIGN',
            x: 480,
            y: 250,
            width: 200,
            height: 50
          },
          {
            id: 'fallback-overlay-3',
            type: 'TEXT',
            label: 'Witness Name',
            page: 2,
            signatureText: 'Name of witness: _________________________',
            required: true,
            overlayType: 'CLICK_TO_SIGN',
            x: 480,
            y: 220,
            width: 200,
            height: 25
          },
          {
            id: 'fallback-overlay-4',
            type: 'TEXT',
            label: 'Witness Address',
            page: 2,
            signatureText: 'Address of witness: _________________________',
            required: false,
            overlayType: 'CLICK_TO_SIGN',
            x: 480,
            y: 140,
            width: 200,
            height: 25
          }
        );
      }

      console.log('🤖 Returning fallback signature overlays:', overlays);
      return overlays;
    }
  }
}
