import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Alert,
  LinearProgress,
  Chip,
  Divider,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as SignIcon,
  CheckCircle as CompleteIcon,
  CheckCircle,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import { documentAPI } from '../services/api';
import SignatureCapture from '../components/SignatureCapture';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const SignDocument: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState<number>(-1);
  const [signedFields, setSignedFields] = useState<Set<string>>(new Set());

  const { data: document, isLoading, error } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentAPI.getDocument(documentId!),
    enabled: !!documentId,
  });

  const signDocumentMutation = useMutation({
    mutationFn: (signatureData: string) =>
      documentAPI.signDocument(documentId!, signatureData),
    onSuccess: () => {
      setCurrentStep(2);
    },
  });

  const steps = ['Review Document', 'Sign Document', 'Complete'];

  const signatureFields = document?.data?.fields?.filter(
    (field: any) => field.type === 'SIGNATURE' || field.type === 'INITIAL'
  ) || [];

  const handleStartSigning = () => {
    setCurrentStep(1);
    if (signatureFields.length > 0) {
      setCurrentFieldIndex(0);
      setCurrentPage(signatureFields[0].page);
    }
  };

  const handleSignField = (fieldId: string) => {
    const fieldIndex = signatureFields.findIndex(field => field.id === fieldId);
    setCurrentFieldIndex(fieldIndex);
    setSignatureDialogOpen(true);
  };

  const handleSaveSignature = (signatureData: string) => {
    if (currentFieldIndex >= 0) {
      const field = signatureFields[currentFieldIndex];
      setSignedFields(prev => new Set([...prev, field.id!]));
      
      // Move to next field or complete if all signed
      if (currentFieldIndex < signatureFields.length - 1) {
        const nextField = signatureFields[currentFieldIndex + 1];
        setCurrentFieldIndex(currentFieldIndex + 1);
        setCurrentPage(nextField.page);
      } else {
        // All fields signed, submit document
        signDocumentMutation.mutate(signatureData);
      }
    }
  };

  const allFieldsSigned = signatureFields.every((field: any) => 
    signedFields.has(field.id!)
  );

  const getFieldPosition = (field: any) => ({
    position: 'absolute' as const,
    left: field.x,
    top: field.y,
    width: field.width,
    height: field.height,
    border: signedFields.has(field.id) ? '2px solid #4caf50' : '2px dashed #ff9800',
    backgroundColor: signedFields.has(field.id) ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading document...</Typography>
      </Box>
    );
  }

  if (error || !document?.data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Document not found or you don't have permission to view it.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {document.data.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {document.data.description}
        </Typography>
        
        <Stepper activeStep={currentStep} sx={{ mt: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      {currentStep === 0 && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Review Document
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Please review the document carefully before signing. You will need to sign {signatureFields.length} field(s).
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {signatureFields.map((field: any, index: number) => (
                  <Chip
                    key={field.id}
                    label={`${field.type} - Page ${field.page}`}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>

              <Button
                variant="contained"
                startIcon={<SignIcon />}
                onClick={handleStartSigning}
                size="large"
              >
                Start Signing Process
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

      {currentStep === 1 && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sign Document
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Click on the highlighted areas to add your signature.
                Progress: {signedFields.size} of {signatureFields.length} fields signed.
              </Typography>
              
              <LinearProgress 
                variant="determinate" 
                value={(signedFields.size / signatureFields.length) * 100}
                sx={{ mb: 2 }}
              />

              {allFieldsSigned && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CompleteIcon />}
                  onClick={() => signDocumentMutation.mutate('final-signature')}
                  disabled={signDocumentMutation.isPending}
                >
                  Complete Signing
                </Button>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {currentStep === 2 && (
        <Box>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CompleteIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Document Signed Successfully!
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Thank you for signing the document. All parties will be notified of the completion.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/dashboard')}
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Document Viewer */}
      {(currentStep === 0 || currentStep === 1) && (
        <Paper sx={{ p: 2, position: 'relative' }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Page {currentPage} of {numPages}
            </Typography>
            {currentStep === 1 && (
              <Typography variant="body2" color="text.secondary">
                Click on highlighted areas to sign
              </Typography>
            )}
          </Box>
          
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <Document
              file={document.data.fileUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<Typography>Loading PDF...</Typography>}
            >
              <Page
                pageNumber={currentPage}
                loading={<Typography>Loading page...</Typography>}
              />
            </Document>

            {/* Signature Field Overlays */}
            {currentStep === 1 && signatureFields
              .filter((field: any) => field.page === currentPage)
              .map((field: any) => (
                <Box
                  key={field.id}
                  sx={getFieldPosition(field)}
                  onClick={() => handleSignField(field.id!)}
                >
                  {signedFields.has(field.id!) ? (
                    <CheckCircle sx={{ color: 'success.main' }} />
                  ) : (
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                      Click to Sign
                    </Typography>
                  )}
                </Box>
              ))}
          </Box>

          {/* Page Navigation */}
          {numPages > 1 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
              <Button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <Button
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {/* Signature Capture Dialog */}
      <SignatureCapture
        open={signatureDialogOpen}
        onClose={() => setSignatureDialogOpen(false)}
        onSave={handleSaveSignature}
        title={
          currentFieldIndex >= 0
            ? `Sign ${signatureFields[currentFieldIndex]?.type} Field`
            : 'Add Signature'
        }
      />
    </Box>
  );
};

export default SignDocument;
