import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import {
  Clear as ClearIcon,
  Undo as UndoIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import SignatureCanvas from 'react-signature-canvas';

// Type declaration for react-signature-canvas
declare module 'react-signature-canvas' {
  interface SignatureCanvasProps {
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
    backgroundColor?: string;
    penColor?: string;
    dotSize?: number;
    minWidth?: number;
    maxWidth?: number;
    throttle?: number;
    minDistance?: number;
    velocityFilterWeight?: number;
    onBegin?: () => void;
    onEnd?: () => void;
  }

  export default class SignatureCanvas extends React.Component<SignatureCanvasProps> {
    clear(): void;
    isEmpty(): boolean;
    toDataURL(type?: string, encoderOptions?: number): string;
    toData(): Array<{ x: number; y: number; time: number }[]>;
    fromData(data: Array<{ x: number; y: number; time: number }[]>): void;
  }
}

interface SignatureCaptureProps {
  open: boolean;
  onClose: () => void;
  onSave: (signatureData: string) => void;
  title?: string;
}

const SignatureCapture: React.FC<SignatureCaptureProps> = ({
  open,
  onClose,
  onSave,
  title = 'Add Your Signature',
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [typedSignature, setTypedSignature] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const signatureRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
    }
  };

  const undoSignature = () => {
    if (signatureRef.current) {
      const data = signatureRef.current.toData();
      if (data.length > 0) {
        data.pop();
        signatureRef.current.fromData(data);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateTypedSignature = (text: string): string => {
    // Create a canvas to generate typed signature
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'black';
      ctx.font = '32px "Brush Script MT", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    
    return canvas.toDataURL();
  };

  const handleSave = () => {
    let signatureData = '';

    switch (tabValue) {
      case 0: // Draw
        if (signatureRef.current && !signatureRef.current.isEmpty()) {
          signatureData = signatureRef.current.toDataURL();
        }
        break;
      case 1: // Type
        if (typedSignature.trim()) {
          signatureData = generateTypedSignature(typedSignature);
        }
        break;
      case 2: // Upload
        if (uploadedImage) {
          signatureData = uploadedImage;
        }
        break;
    }

    if (signatureData) {
      onSave(signatureData);
      handleClose();
    }
  };

  const handleClose = () => {
    setTabValue(0);
    setTypedSignature('');
    setUploadedImage(null);
    if (signatureRef.current) {
      signatureRef.current.clear();
    }
    onClose();
  };

  const isSignatureValid = () => {
    switch (tabValue) {
      case 0:
        // For draw tab, check if signature canvas has content
        if (signatureRef.current) {
          try {
            return !signatureRef.current.isEmpty();
          } catch (error) {
            console.error('Error checking signature canvas:', error);
            return false;
          }
        }
        return false;
      case 1:
        return typedSignature.trim().length > 0;
      case 2:
        return uploadedImage !== null;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Draw" />
          <Tab label="Type" />
          <Tab label="Upload" />
        </Tabs>

        {/* Draw Tab */}
        {tabValue === 0 && (
          <Box>
            <Paper
              elevation={1}
              sx={{
                border: '2px dashed #ccc',
                borderRadius: 1,
                p: 1,
                mb: 2,
              }}
            >
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  width: 500,
                  height: 200,
                  className: 'signature-canvas',
                  style: { width: '100%', height: '200px' },
                }}
                backgroundColor="white"
                penColor="black"
                onBegin={() => {
                  // User started drawing - no action needed
                }}
                onEnd={() => {
                  // User finished drawing - force component re-render to update button state
                  setTimeout(() => {
                    // Trigger a state update to re-evaluate button state
                    setTypedSignature(prev => prev);
                  }, 10);
                }}
              />
            </Paper>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={clearSignature}
              >
                Clear
              </Button>
              <Button
                variant="outlined"
                startIcon={<UndoIcon />}
                onClick={undoSignature}
              >
                Undo
              </Button>
            </Box>
          </Box>
        )}

        {/* Type Tab */}
        {tabValue === 1 && (
          <Box>
            <TextField
              fullWidth
              label="Type your signature"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              sx={{ mb: 2 }}
              inputProps={{
                style: {
                  fontSize: '24px',
                  fontFamily: '"Brush Script MT", cursive',
                },
              }}
            />
            {typedSignature && (
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  border: '1px solid #ccc',
                  backgroundColor: '#f9f9f9',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '32px',
                    fontFamily: '"Brush Script MT", cursive',
                  }}
                >
                  {typedSignature}
                </Typography>
              </Paper>
            )}
          </Box>
        )}

        {/* Upload Tab */}
        {tabValue === 2 && (
          <Box>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              ref={fileInputRef}
            />
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ mb: 2 }}
            >
              Choose Image File
            </Button>
            {uploadedImage && (
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  border: '1px solid #ccc',
                }}
              >
                <img
                  src={uploadedImage}
                  alt="Uploaded signature"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    objectFit: 'contain',
                  }}
                />
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isSignatureValid()}
        >
          Save Signature
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SignatureCapture;
