import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Toolbar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Alert,
} from '@mui/material';
import {
  Edit as SignatureIcon,
  TextFields as TextIcon,
  DateRange as DateIcon,
  CheckBox as CheckboxIcon,
  Send as SendIcon,
  Save as SaveIcon,
  SmartToy as AIIcon,
  ZoomIn,
  ZoomOut,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import { fabric } from 'fabric';
import { documentAPI, aiAPI } from '../services/api';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DocumentField {
  id?: string;
  type: 'SIGNATURE' | 'INITIAL' | 'DATE' | 'TEXT' | 'CHECKBOX';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  signerEmail?: string;
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [signers, setSigners] = useState<Array<{ email: string; name: string }>>([
    { email: '', name: '' }
  ]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentAPI.getDocument(id!),
    enabled: !!id,
  });

  const saveFieldsMutation = useMutation({
    mutationFn: (fields: DocumentField[]) => documentAPI.addFields(id!, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] });
    },
  });

  const sendDocumentMutation = useMutation({
    mutationFn: (signers: Array<{ email: string; name: string }>) =>
      documentAPI.sendDocument(id!, signers),
    onSuccess: () => {
      navigate('/documents');
    },
  });

  const detectFieldsMutation = useMutation({
    mutationFn: () => aiAPI.detectFields(id!),
    onSuccess: (data) => {
      console.log('🤖 AI API Response:', data);
      console.log('🤖 AI detected fields raw:', data.data);
      
      // Handle multiple possible response formats
      const fieldsArray = data.data?.fields || data.data?.data || data.data || [];
      console.log('🤖 Fields array:', fieldsArray);
      
      if (!Array.isArray(fieldsArray) || fieldsArray.length === 0) {
        console.log('⚠️ No fields detected by AI, creating default fields for multi-page document');
        
        // Create default fields for a 2-page document with signatures on page 2
        const defaultFields: DocumentField[] = [
          {
            id: `default-${Date.now()}-0`,
            type: 'SIGNATURE' as const,
            label: 'Primary Signature',
            x: 100,
            y: 200,
            width: 250,
            height: 60,
            page: 2, // Put on page 2 where signatures typically are
            required: true,
          },
          {
            id: `default-${Date.now()}-1`,
            type: 'DATE' as const,
            label: 'Signature Date',
            x: 400,
            y: 200,
            width: 150,
            height: 25,
            page: 2,
            required: true,
          },
          {
            id: `default-${Date.now()}-2`,
            type: 'TEXT' as const,
            label: 'Printed Name',
            x: 100,
            y: 300,
            width: 200,
            height: 25,
            page: 2,
            required: false,
          },
          {
            id: `default-${Date.now()}-3`,
            type: 'SIGNATURE' as const,
            label: 'Witness Signature',
            x: 100,
            y: 400,
            width: 250,
            height: 60,
            page: 2,
            required: true,
          },
          {
            id: `default-${Date.now()}-4`,
            type: 'TEXT' as const,
            label: 'Witness Name',
            x: 400,
            y: 400,
            width: 200,
            height: 25,
            page: 2,
            required: true,
          },
        ];
        
        console.log('📝 Created default fields:', defaultFields);
        setFields(defaultFields);
        
        // Don't auto-navigate, let user see fields are created
        console.log('📄 Default fields created for page 2');
        
        // Just re-render current page
        setTimeout(() => {
          console.log('🔄 Re-rendering default fields...');
          if (canvas) {
            addFieldsToCanvas(defaultFields);
          }
        }, 100);
        return;
      }
      
      const aiFields = fieldsArray.map((field: any, index: number) => {
        console.log(`🔍 Processing field ${index}:`, field);
        
        // Generic positioning that works for any document
        const column = index % 2; // Alternate between left and right columns
        const row = Math.floor(index / 2);
        
        let x = column === 0 ? 100 : 350; // Left or right column
        let y = 150 + (row * 100); // Vertical spacing
        let width = 200;
        let height = 30;
        let page = 2; // Default to page 2 for signatures
        
        // Adjust dimensions based on field type
        if (field.type === 'SIGNATURE') {
          width = 250;
          height = 60;
        } else if (field.type === 'TEXT') {
          width = 200;
          height = 25;
        } else if (field.type === 'DATE') {
          width = 150;
          height = 25;
        } else if (field.type === 'INITIAL') {
          width = 100;
          height = 40;
        }
        
        // Use suggested page if available, otherwise default to page 2
        if (field.suggestedPage && field.suggestedPage <= numPages) {
          page = field.suggestedPage;
        }
        
        // Ensure fields stay within reasonable bounds
        if (x + width > 600) x = 600 - width;
        if (y + height > 800) y = 150 + ((index % 4) * 80);
        
        return {
          id: `ai-${Date.now()}-${index}`,
          type: (field.type || 'SIGNATURE') as DocumentField['type'],
          label: field.label || `${field.type || 'SIGNATURE'} Field ${index + 1}`,
          x,
          y,
          width,
          height,
          page,
          required: field.required !== false, // Default to true
        };
      });
      
      console.log('✅ Generated AI fields:', aiFields);
      
      // Set fields first
      setFields(aiFields);
      
      // Don't automatically navigate - let user navigate manually
      console.log('📄 Fields distributed across pages:', 
        aiFields.reduce((acc, field) => {
          acc[field.page] = (acc[field.page] || 0) + 1;
          return acc;
        }, {} as Record<number, number>)
      );
      
      // Just re-render current page
      setTimeout(() => {
        console.log('🔄 Re-rendering fields for current page...');
        if (canvas) {
          addFieldsToCanvas(aiFields);
        }
      }, 100);
    },
    onError: (error) => {
      console.error('❌ AI field detection failed:', error);
      
      // Create fallback fields on page 2
      const fallbackFields: DocumentField[] = [
        {
          id: `fallback-${Date.now()}-0`,
          type: 'SIGNATURE' as const,
          label: 'Primary Signature',
          x: 100,
          y: 200,
          width: 250,
          height: 60,
          page: 2,
          required: true,
        },
        {
          id: `fallback-${Date.now()}-1`,
          type: 'DATE' as const,
          label: 'Date',
          x: 400,
          y: 200,
          width: 150,
          height: 25,
          page: 2,
          required: true,
        },
      ];
      
      console.log('🔄 Using fallback fields:', fallbackFields);
      setFields(fallbackFields);
      console.log('📄 Fallback fields created for page 2');
      
      // Just re-render current page
      setTimeout(() => {
        console.log('🔄 Re-rendering fallback fields...');
        if (canvas) {
          addFieldsToCanvas(fallbackFields);
        }
      }, 100);
    },
  });

  useEffect(() => {
    console.log('🎯 Canvas initialization useEffect');
    console.log('Canvas ref current:', !!canvasRef.current);
    console.log('Canvas state:', !!canvas);
    
    // Add a small delay to ensure the canvas element is fully rendered
    const initCanvas = () => {
      if (canvasRef.current && !canvas) {
        console.log('🎨 Creating new fabric canvas...');
        
        try {
          const fabricCanvas = new fabric.Canvas(canvasRef.current, {
            width: 800, // Will be updated when PDF loads
            height: 1000, // Will be updated when PDF loads
            selection: true,
            backgroundColor: 'transparent',
          });
          
          console.log('✅ Fabric canvas created:', {
            width: fabricCanvas.getWidth(),
            height: fabricCanvas.getHeight()
          });
          
          fabricCanvas.on('object:modified', handleFieldModified);
          fabricCanvas.on('object:removed', handleFieldRemoved);
          
          setCanvas(fabricCanvas);
          console.log('✅ Canvas state updated');
        } catch (error) {
          console.error('❌ Failed to create fabric canvas:', error);
        }
      }
    };

    // Use setTimeout to ensure DOM is ready
    const timeoutId = setTimeout(initCanvas, 100);

    return () => {
      clearTimeout(timeoutId);
      if (canvas) {
        console.log('🧹 Disposing canvas...');
        try {
          canvas.dispose();
        } catch (error) {
          console.error('Error disposing canvas:', error);
        }
      }
    };
  }, [canvasRef.current]);

  useEffect(() => {
    if (document?.data?.fields) {
      setFields(document.data.fields);
    }
  }, [document]);

  useEffect(() => {
    console.log('useEffect triggered - canvas:', !!canvas, 'fields:', fields.length, 'currentPage:', currentPage);
    console.log('All fields:', fields);
    console.log('Fields for current page:', fields.filter(f => f.page === currentPage));
    if (canvas) {
      console.log('Canvas dimensions:', canvas.getWidth(), 'x', canvas.getHeight());
      addFieldsToCanvas(fields);
    }
  }, [canvas, fields, currentPage]);

  const handleFieldModified = (e: fabric.IEvent) => {
    const obj = e.target;
    if (obj && obj.data) {
      const fieldId = obj.data.fieldId;
      setFields(prev => prev.map(field => 
        field.id === fieldId 
          ? { 
              ...field, 
              x: obj.left || 0, 
              y: obj.top || 0,
              width: obj.width || 0,
              height: obj.height || 0,
            }
          : field
      ));
    }
  };

  const handleFieldRemoved = (e: fabric.IEvent) => {
    const obj = e.target;
    if (obj && obj.data) {
      const fieldId = obj.data.fieldId;
      setFields(prev => prev.filter(field => field.id !== fieldId));
    }
  };

  const addFieldsToCanvas = (fieldsToAdd: DocumentField[]) => {
    console.log('=== addFieldsToCanvas called ===');
    console.log('Canvas ready:', !!canvas);
    console.log('Total fields to add:', fieldsToAdd.length);
    console.log('Current page:', currentPage);
    
    if (!canvas) {
      console.log('❌ Canvas not ready - returning early');
      return;
    }

    // Check if canvas is properly initialized
    try {
      const canvasElement = canvas.getElement();
      if (!canvasElement) {
        console.log('❌ Canvas element not found - returning early');
        return;
      }
    } catch (error) {
      console.error('❌ Canvas not properly initialized:', error);
      return;
    }

    console.log('Canvas state:', {
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      objectCount: canvas.getObjects().length
    });

    // Clear existing objects first - with error handling
    console.log('Clearing canvas...');
    try {
      canvas.clear();
    } catch (error) {
      console.error('Error clearing canvas:', error);
      return;
    }

    // Get current page fields
    const currentPageFields = fieldsToAdd.filter(field => field.page === currentPage);
    
    console.log(`📋 Fields for page ${currentPage}:`, currentPageFields.map(f => ({
      id: f.id,
      type: f.type,
      label: f.label,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      page: f.page
    })));

    if (currentPageFields.length === 0) {
      console.log('⚠️ No fields to render for current page');
      return;
    }

    currentPageFields.forEach((field, index) => {
      console.log(`\n--- Processing field ${index + 1}/${currentPageFields.length} ---`);
      console.log('Field details:', {
        id: field.id,
        type: field.type,
        label: field.label,
        position: `(${field.x}, ${field.y})`,
        size: `${field.width}x${field.height}`,
        page: field.page
      });

      let fieldColor;
      let fieldLabel;
      
      switch (field.type) {
        case 'SIGNATURE':
          fieldColor = '#ffc107';
          fieldLabel = 'SIGNATURE';
          break;
        case 'TEXT':
          fieldColor = '#2196f3';
          fieldLabel = 'TEXT';
          break;
        case 'DATE':
          fieldColor = '#4caf50';
          fieldLabel = 'DATE';
          break;
        case 'CHECKBOX':
          fieldColor = '#9c27b0';
          fieldLabel = 'CHECKBOX';
          break;
        case 'INITIAL':
          fieldColor = '#ff5722';
          fieldLabel = 'INITIAL';
          break;
        default:
          fieldColor = '#666';
          fieldLabel = field.type;
      }

      // Use field coordinates directly, but ensure they're within bounds
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      
      console.log('Canvas bounds:', { width: canvasWidth, height: canvasHeight });
      console.log('Original field position:', { x: field.x, y: field.y });
      
      let x = Math.max(5, Math.min(field.x, canvasWidth - field.width - 5));
      let y = Math.max(5, Math.min(field.y, canvasHeight - field.height - 5));

      console.log('Adjusted field position:', { x, y });
      console.log('Field color:', fieldColor);

      try {
        // Create field rectangle
        const fabricObject = new fabric.Rect({
          left: x,
          top: y,
          width: field.width,
          height: field.height,
          fill: `${fieldColor}40`, // Increased opacity for better visibility
          stroke: fieldColor,
          strokeWidth: 3, // Thicker stroke
          strokeDashArray: field.type === 'SIGNATURE' ? [5, 5] : [],
          cornerColor: fieldColor,
          cornerSize: 8,
          transparentCorners: false,
          hasRotatingPoint: false,
        });

        console.log('✅ Created fabric rectangle');

        // Add label text
        const labelText = new fabric.Text(`${field.label}`, {
          left: x + 5,
          top: y + 5,
          fontSize: 12, // Larger font
          fill: fieldColor,
          fontWeight: 'bold',
          selectable: false,
          evented: false,
        });

        console.log('✅ Created fabric text');

        // Set field data for identification
        fabricObject.data = { fieldId: field.id, fieldType: field.type };
        
        // Add to canvas
        canvas.add(fabricObject);
        console.log('✅ Added rectangle to canvas');
        
        canvas.add(labelText);
        console.log('✅ Added text to canvas');

      } catch (error) {
        console.error('❌ Error creating field objects:', error);
      }
    });
    
    console.log('\n🎨 Rendering canvas...');
    try {
      canvas.renderAll();
      
      const finalObjectCount = canvas.getObjects().length;
      console.log(`✅ Canvas rendered with ${finalObjectCount} objects for page ${currentPage}`);
      console.log('Canvas objects:', canvas.getObjects().map(obj => ({
        type: obj.type,
        left: obj.left,
        top: obj.top,
        width: obj.width,
        height: obj.height
      })));
      
      // Add a small delay to ensure stability
      setTimeout(() => {
        console.log('🔄 Final render confirmation...');
        try {
          if (canvas && canvas.getElement()) {
            canvas.renderAll();
          }
        } catch (error) {
          console.error('Error in final render:', error);
        }
      }, 50);
    } catch (error) {
      console.error('Error rendering canvas:', error);
    }
  };

  const addField = (type: DocumentField['type']) => {
    if (!canvas) return;
    
    const canvasCenter = {
      x: canvas.getWidth() / 2,
      y: canvas.getHeight() / 2
    };
    
    const newField: DocumentField = {
      id: `field-${Date.now()}`,
      type,
      label: `${type} Field`,
      x: canvasCenter.x - (type === 'SIGNATURE' ? 100 : 75), // Center the field
      y: canvasCenter.y - (type === 'SIGNATURE' ? 30 : 15),
      width: type === 'SIGNATURE' ? 200 : 150,
      height: type === 'SIGNATURE' ? 60 : 30,
      page: currentPage,
      required: true,
    };

    setFields([...fields, newField]);
    addFieldsToCanvas([newField]);
    setSelectedTool('');
  };

  const saveFields = () => {
    saveFieldsMutation.mutate(fields);
  };

  const handleSendDocument = () => {
    const validSigners = signers.filter(s => s.email && s.name);
    if (validSigners.length === 0) {
      return;
    }
    sendDocumentMutation.mutate(validSigners);
    setSendDialogOpen(false);
  };

  const addSigner = () => {
    setSigners([...signers, { email: '', name: '' }]);
  };

  const updateSigner = (index: number, field: 'email' | 'name', value: string) => {
    const newSigners = [...signers];
    newSigners[index][field] = value;
    setSigners(newSigners);
  };

  const removeSigner = (index: number) => {
    setSigners(signers.filter((_, i) => i !== index));
  };

  const fieldTools = [
    { type: 'SIGNATURE', icon: <SignatureIcon />, label: 'Signature', color: '#ffc107' },
    { type: 'TEXT', icon: <TextIcon />, label: 'Text', color: '#2196f3' },
    { type: 'DATE', icon: <DateIcon />, label: 'Date', color: '#4caf50' },
    { type: 'CHECKBOX', icon: <CheckboxIcon />, label: 'Checkbox', color: '#9c27b0' },
  ];

  if (isLoading) {
    return <Box>Loading document...</Box>;
  }

  if (!document?.data) {
    return <Box>Document not found</Box>;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Toolbar */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: 280,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            position: 'relative',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            {document.data.title}
          </Typography>
          
          <Typography variant="subtitle2" gutterBottom>
            Field Tools
          </Typography>
          
          <List>
            {fieldTools.map((tool) => (
              <ListItem
                key={tool.type}
                button
                onClick={() => addField(tool.type as DocumentField['type'])}
                sx={{
                  border: `2px solid ${tool.color}`,
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    backgroundColor: `${tool.color}20`,
                  },
                }}
              >
                <ListItemIcon sx={{ color: tool.color }}>
                  {tool.icon}
                </ListItemIcon>
                <ListItemText primary={tool.label} />
              </ListItem>
            ))}
          </List>

          <Button
            fullWidth
            variant="outlined"
            startIcon={<AIIcon />}
            onClick={() => detectFieldsMutation.mutate()}
            disabled={detectFieldsMutation.isPending}
            sx={{ mt: 2, mb: 2 }}
            title="Requires OpenRouter API key to be configured"
          >
            {detectFieldsMutation.isPending ? 'Detecting...' : 'AI Detect Fields'}
          </Button>
          {detectFieldsMutation.error && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
              AI service unavailable. Please configure OpenRouter API key.
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveFields}
            disabled={saveFieldsMutation.isPending}
            sx={{ mb: 1 }}
          >
            Save Fields
          </Button>

          <Button
            fullWidth
            variant="contained"
            color="success"
            startIcon={<SendIcon />}
            onClick={() => setSendDialogOpen(true)}
            disabled={fields.length === 0}
          >
            Send for Signature
          </Button>

          <Button
            fullWidth
            variant="outlined"
            onClick={() => {
              console.log('Manual render test - fields:', fields);
              console.log('Canvas ready:', !!canvas);
              if (canvas) {
                addFieldsToCanvas(fields);
              }
            }}
            sx={{ mt: 1 }}
          >
            DEBUG: Force Render Fields
          </Button>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              All Fields ({fields.length})
            </Typography>
            <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
              {fields.map((field: DocumentField, index: number) => (
                <Box key={field.id} sx={{ mb: 1 }}>
                  <Chip
                    label={`${index + 1}. ${field.type} - Page ${field.page}`}
                    size="small"
                    color={field.page === currentPage ? 'primary' : 'default'}
                    sx={{ mr: 1 }}
                    onClick={() => {
                      if (field.page !== currentPage) {
                        setCurrentPage(field.page);
                      }
                    }}
                    onDelete={() => {
                      setFields(fields.filter(f => f.id !== field.id));
                      // Refresh canvas
                      if (canvas) {
                        addFieldsToCanvas(fields.filter(f => f.id !== field.id));
                      }
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 1 }}>
                    {field.label} ({field.x}, {field.y})
                  </Typography>
                </Box>
              ))}
            </Box>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Current page: {currentPage} | Fields on this page: {fields.filter(f => f.page === currentPage).length}
            </Typography>
          </Box>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <Toolbar sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <IconButton onClick={() => setScale(Math.max(0.5, scale - 0.1))}>
            <ZoomOut />
          </IconButton>
          <Typography sx={{ mx: 2 }}>
            {Math.round(scale * 100)}%
          </Typography>
          <IconButton onClick={() => setScale(Math.min(2.0, scale + 0.1))}>
            <ZoomIn />
          </IconButton>
          
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Typography>
              Page {currentPage} of {numPages}
            </Typography>
            <Button
              size="small"
              disabled={currentPage >= numPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </Box>
        </Toolbar>

        <Box sx={{ position: 'relative', overflow: 'auto', height: 'calc(100vh - 64px)', p: 2 }}>
          <div 
            id="pdf-container"
            style={{ 
              position: 'relative', 
              display: 'inline-block',
              border: '1px solid #ddd',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <Document
              file={document.data.fileUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<Typography>Loading PDF...</Typography>}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                loading={<Typography>Loading page...</Typography>}
                onLoadSuccess={(page) => {
                  console.log('📄 PDF page loaded:', {
                    pageNumber: currentPage,
                    width: page.width,
                    height: page.height,
                    scale: scale
                  });
                  
                  // Update canvas size to match PDF page exactly
                  if (canvas) {
                    try {
                      const pdfWidth = page.width;
                      const pdfHeight = page.height;
                      
                      console.log('🎨 Updating canvas size:', { pdfWidth, pdfHeight });
                      
                      canvas.setWidth(pdfWidth);
                      canvas.setHeight(pdfHeight);
                      canvas.calcOffset();
                      
                      // Update canvas element size
                      const canvasElement = canvasRef.current;
                      if (canvasElement) {
                        canvasElement.style.width = `${pdfWidth}px`;
                        canvasElement.style.height = `${pdfHeight}px`;
                        console.log('✅ Canvas element size updated');
                      }
                      
                      // Re-render fields after canvas resize
                      console.log('🔄 Re-rendering fields after canvas resize...');
                      setTimeout(() => {
                        if (canvas && canvas.getElement()) {
                          addFieldsToCanvas(fields);
                        }
                      }, 200);
                    } catch (error) {
                      console.error('Error updating canvas size:', error);
                    }
                  }
                }}
              />
            </Document>
            
            {/* Canvas overlay for field placement */}
            <canvas
              ref={canvasRef}
              width={800}
              height={1000}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'auto',
                zIndex: 10,
                cursor: selectedTool ? 'crosshair' : 'default',
                border: '1px solid transparent', // Help with debugging
              }}
            />
          </div>
        </Box>
      </Box>

      {/* Send Document Dialog */}
      <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Send Document for Signature</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Add recipients who need to sign this document:
          </Typography>
          
          {signers.map((signer: { email: string; name: string }, index: number) => (
            <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
              <Grid item xs={5}>
                <TextField
                  fullWidth
                  label="Name"
                  value={signer.name}
                  onChange={(e) => updateSigner(index, 'name', e.target.value)}
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={signer.email}
                  onChange={(e) => updateSigner(index, 'email', e.target.value)}
                />
              </Grid>
              <Grid item xs={2}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => removeSigner(index)}
                  disabled={signers.length === 1}
                >
                  Remove
                </Button>
              </Grid>
            </Grid>
          ))}
          
          <Button variant="outlined" onClick={addSigner} sx={{ mt: 1 }}>
            Add Another Signer
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSendDocument}
            disabled={sendDocumentMutation.isPending}
          >
            Send Document
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentEditor;
