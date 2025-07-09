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
      console.log('AI detected fields:', data.data.fields);
      
      const aiFields = data.data.fields.map((field: any, index: number) => {
        // Calculate position based on field index and type
        const fieldsPerColumn = 4;
        const columnIndex = Math.floor(index / fieldsPerColumn);
        const rowIndex = index % fieldsPerColumn;
        
        let x = 50 + (columnIndex * 280); // Multiple columns
        let y = 100 + (rowIndex * 80); // Spread vertically
        let width = 200;
        let height = 30;
        let page = currentPage;
        
        // Adjust dimensions based on field type
        if (field.type === 'SIGNATURE') {
          width = 250;
          height = 60;
        } else if (field.type === 'TEXT') {
          width = 300;
          height = 25;
        } else if (field.type === 'DATE') {
          width = 150;
          height = 25;
        } else if (field.type === 'INITIAL') {
          width = 100;
          height = 40;
        }
        
        // Position based on section for better organization
        if (field.section === 'witness') {
          x = 50; // Left side for witness fields
        } else if (field.section === 'company') {
          x = 350; // Right side for company fields
          // Company sections might be on different pages
          if (index >= 4) {
            page = Math.min(numPages, currentPage + 1);
          }
        } else if (field.section === 'individual') {
          x = 200; // Center for individual fields
        }
        
        // Ensure fields stay within reasonable bounds
        if (x + width > 600) x = 600 - width;
        if (y + height > 700) {
          y = 100 + ((index % 3) * 80);
          page = Math.min(numPages, currentPage + 1);
        }
        
        return {
          id: `ai-${Date.now()}-${index}`,
          type: field.type,
          label: field.label || `${field.type} Field ${index + 1}`,
          x,
          y,
          width,
          height,
          page,
          required: field.required || false,
        };
      });
      
      console.log('Generated AI fields:', aiFields);
      setFields(prevFields => [...prevFields, ...aiFields]);
      
      // If we're on the current page, render the fields immediately
      const currentPageAIFields = aiFields.filter((f: DocumentField) => f.page === currentPage);
      if (currentPageAIFields.length > 0) {
        addFieldsToCanvas([...fields, ...aiFields]);
      }
    },
  });

  useEffect(() => {
    if (canvasRef.current && !canvas) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: 800, // Will be updated when PDF loads
        height: 1000, // Will be updated when PDF loads
        selection: true,
        backgroundColor: 'transparent',
      });
      
      fabricCanvas.on('object:modified', handleFieldModified);
      fabricCanvas.on('object:removed', handleFieldRemoved);
      
      setCanvas(fabricCanvas);
    }

    return () => {
      if (canvas) {
        canvas.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (document?.data?.fields) {
      setFields(document.data.fields);
    }
  }, [document]);

  useEffect(() => {
    if (canvas && fields.length > 0) {
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
    if (!canvas) return;

    // Clear existing objects first
    canvas.clear();

    // Get current page fields
    const currentPageFields = fieldsToAdd.filter(field => field.page === currentPage);
    
    console.log(`Rendering ${currentPageFields.length} fields for page ${currentPage}:`, currentPageFields);

    currentPageFields.forEach((field, index) => {
      let fabricObject;
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

      // Ensure field is within canvas bounds
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      
      let adjustedX = Math.max(10, Math.min(field.x, canvasWidth - field.width - 10));
      let adjustedY = Math.max(10, Math.min(field.y, canvasHeight - field.height - 10));
      
      // If fields are overlapping, spread them out
      if (index > 0) {
        const previousFields = currentPageFields.slice(0, index);
        let attempts = 0;
        while (attempts < 10) {
          const overlapping = previousFields.some(prevField => {
            return Math.abs(adjustedX - prevField.x) < field.width && 
                   Math.abs(adjustedY - prevField.y) < field.height;
          });
          
          if (!overlapping) break;
          
          adjustedY += 70; // Move down
          if (adjustedY + field.height > canvasHeight - 10) {
            adjustedY = 10;
            adjustedX += 220; // Move right
          }
          attempts++;
        }
      }

      // Create field rectangle
      fabricObject = new fabric.Rect({
        left: adjustedX,
        top: adjustedY,
        width: field.width,
        height: field.height,
        fill: `${fieldColor}30`, // 30% opacity
        stroke: fieldColor,
        strokeWidth: 2,
        strokeDashArray: field.type === 'SIGNATURE' ? [5, 5] : [],
        cornerColor: fieldColor,
        cornerSize: 8,
        transparentCorners: false,
        hasRotatingPoint: false,
      });

      // Add label text with field number for easier identification
      const labelText = new fabric.Text(`${fieldLabel} ${index + 1}`, {
        left: adjustedX + 5,
        top: adjustedY + 5,
        fontSize: 10,
        fill: fieldColor,
        fontWeight: 'bold',
        selectable: false,
        evented: false,
      });

      if (fabricObject) {
        fabricObject.data = { fieldId: field.id, fieldType: field.type };
        canvas.add(fabricObject);
        canvas.add(labelText);
        
        // Update field position in state if it was adjusted
        if (adjustedX !== field.x || adjustedY !== field.y) {
          setFields(prev => prev.map(f => 
            f.id === field.id 
              ? { ...f, x: adjustedX, y: adjustedY }
              : f
          ));
        }
      }
    });
    
    canvas.renderAll();
    console.log(`Canvas rendered with ${canvas.getObjects().length} objects`);
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
                  // Update canvas size to match PDF page exactly
                  if (canvas) {
                    const pdfWidth = page.width;
                    const pdfHeight = page.height;
                    
                    canvas.setWidth(pdfWidth);
                    canvas.setHeight(pdfHeight);
                    canvas.calcOffset();
                    canvas.renderAll();
                    
                    // Update canvas element size
                    const canvasElement = canvasRef.current;
                    if (canvasElement) {
                      canvasElement.style.width = `${pdfWidth}px`;
                      canvasElement.style.height = `${pdfHeight}px`;
                    }
                  }
                }}
              />
            </Document>
            
            {/* Canvas overlay for field placement */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'auto',
                zIndex: 10,
                cursor: selectedTool ? 'crosshair' : 'default',
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
