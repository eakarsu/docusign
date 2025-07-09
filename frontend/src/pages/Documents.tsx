import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Alert,
  Fab,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Send as SendIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CloudUpload as UploadIcon,
  SmartToy as AIIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewList as ListViewIcon,
  ViewModule as GridViewIcon,
  Sort as SortIcon,
  SelectAll as SelectAllIcon,
  Share as ShareIcon,
  Archive as ArchiveIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { documentAPI, aiAPI } from '../services/api';

interface Document {
  id: string;
  title: string;
  description?: string;
  status: 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  sender: {
    firstName: string;
    lastName: string;
    email: string;
  };
  signatures: Array<{
    status: string;
    signerEmail: string;
    signerName: string;
    signedAt?: string;
  }>;
  _count: {
    signatures: number;
  };
}

const Documents: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentAPI.getDocuments(),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => documentAPI.uploadDocument(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setUploadDialogOpen(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadedFile(null);
    },
  });

  const analyzeDocumentMutation = useMutation({
    mutationFn: (documentId: string) => aiAPI.analyzeDocument(documentId),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => documentAPI.deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploadedFile(acceptedFiles[0]);
        setUploadDialogOpen(true);
      }
    },
  });

  const handleUpload = () => {
    if (!uploadedFile || !uploadTitle.trim()) return;

    const formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('title', uploadTitle);
    if (uploadDescription) {
      formData.append('description', uploadDescription);
    }

    uploadMutation.mutate(formData);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, document: Document) => {
    setMenuAnchor(event.currentTarget);
    setSelectedDocument(document);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedDocument(null);
  };

  const handleDeleteDocument = () => {
    if (selectedDocument) {
      deleteDocumentMutation.mutate(selectedDocument.id);
    }
    handleMenuClose();
  };

  const handleDownloadDocument = () => {
    if (selectedDocument) {
      window.open(selectedDocument.fileUrl, '_blank');
    }
    handleMenuClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'SENT':
      case 'IN_PROGRESS':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '✅';
      case 'SENT':
      case 'IN_PROGRESS':
        return '⏳';
      case 'CANCELLED':
        return '❌';
      default:
        return '📄';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading documents...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load documents. Please try again.
        </Alert>
      </Box>
    );
  }

  const documentList = documents?.data || [];

  const filteredDocuments = documentList.filter((doc: Document) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const sortedDocuments = [...filteredDocuments].sort((a: Document, b: Document) => {
    switch (sortBy) {
      case 'name':
        return a.title.localeCompare(b.title);
      case 'status':
        return a.status.localeCompare(b.status);
      case 'date':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const handleBulkAction = (action: string) => {
    console.log(`Bulk ${action} for documents:`, Array.from(selectedDocuments));
    setSelectedDocuments(new Set());
    setBulkSelectMode(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Enhanced Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Documents ({filteredDocuments.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SelectAllIcon />}
            onClick={() => setBulkSelectMode(!bulkSelectMode)}
            color={bulkSelectMode ? 'primary' : 'inherit'}
          >
            {bulkSelectMode ? 'Cancel' : 'Select'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload Document
          </Button>
        </Box>
      </Box>

      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              size="small"
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              select
              fullWidth
              label="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              size="small"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="SENT">Sent</MenuItem>
              <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              select
              fullWidth
              label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              size="small"
            >
              <MenuItem value="date">Date</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <IconButton
                onClick={() => setViewMode('list')}
                color={viewMode === 'list' ? 'primary' : 'default'}
              >
                <ListViewIcon />
              </IconButton>
              <IconButton
                onClick={() => setViewMode('grid')}
                color={viewMode === 'grid' ? 'primary' : 'default'}
              >
                <GridViewIcon />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Bulk Actions Bar */}
      {bulkSelectMode && selectedDocuments.size > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography>
              {selectedDocuments.size} document(s) selected
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={<ShareIcon />}
                onClick={() => handleBulkAction('share')}
                sx={{ color: 'inherit' }}
              >
                Share
              </Button>
              <Button
                size="small"
                startIcon={<ArchiveIcon />}
                onClick={() => handleBulkAction('archive')}
                sx={{ color: 'inherit' }}
              >
                Archive
              </Button>
              <Button
                size="small"
                startIcon={<DeleteIcon />}
                onClick={() => handleBulkAction('delete')}
                sx={{ color: 'inherit' }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Drag and Drop Area */}
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed #ccc',
          borderRadius: 2,
          p: 3,
          mb: 3,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        <input {...getInputProps()} />
        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive ? 'Drop files here' : 'Drag & drop documents here'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supports PDF, DOC, and DOCX files
        </Typography>
      </Box>

      {/* Documents Display */}
      {sortedDocuments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchQuery || filterStatus !== 'all' ? 'No documents match your filters' : 'No documents yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Upload your first document to get started with electronic signatures'
            }
          </Typography>
          {!searchQuery && filterStatus === 'all' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Your First Document
            </Button>
          )}
        </Box>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={3}>
          {sortedDocuments.map((document: any) => (
            <Grid item xs={12} sm={6} md={4} key={document.id}>
              <Card sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                position: 'relative',
                '&:hover': { boxShadow: 4 }
              }}>
                {bulkSelectMode && (
                  <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
                    <Checkbox
                      checked={selectedDocuments.has(document.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedDocuments);
                        if (e.target.checked) {
                          newSelected.add(document.id);
                        } else {
                          newSelected.delete(document.id);
                        }
                        setSelectedDocuments(newSelected);
                      }}
                    />
                  </Box>
                )}
                <CardContent sx={{ flexGrow: 1, pt: bulkSelectMode ? 6 : 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h2" sx={{ flexGrow: 1, mr: 1 }}>
                      {document.title}
                    </Typography>
                    {!bulkSelectMode && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, document)}
                      >
                        <MoreIcon />
                      </IconButton>
                    )}
                  </Box>

                  {document.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {document.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <span>{getStatusIcon(document.status)}</span>
                    <Chip
                      label={document.status}
                      color={getStatusColor(document.status) as any}
                      size="small"
                    />
                  </Box>

                  <Typography variant="caption" color="text.secondary" display="block">
                    Created: {new Date(document.createdAt).toLocaleDateString()}
                  </Typography>

                  {document._count.signatures > 0 && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Signatures: {document.signatures.filter((s: any) => s.status === 'SIGNED').length} / {document._count.signatures}
                    </Typography>
                  )}
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => navigate(`/documents/${document.id}/edit`)}
                  >
                    View
                  </Button>
                  {document.status === 'DRAFT' && (
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => navigate(`/documents/${document.id}/edit`)}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    size="small"
                    startIcon={<ShareIcon />}
                  >
                    Share
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        // List View
        <Paper>
          <List>
            {sortedDocuments.map((document: any, index) => (
              <React.Fragment key={document.id}>
                <ListItem
                  sx={{
                    '&:hover': { bgcolor: 'action.hover' },
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/documents/${document.id}/edit`)}
                >
                  {bulkSelectMode && (
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedDocuments.has(document.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newSelected = new Set(selectedDocuments);
                          if (e.target.checked) {
                            newSelected.add(document.id);
                          } else {
                            newSelected.delete(document.id);
                          }
                          setSelectedDocuments(newSelected);
                        }}
                      />
                    </ListItemIcon>
                  )}
                  <ListItemIcon>
                    <DocumentIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={document.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" component="span">
                          {document.description}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          Created: {new Date(document.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={document.status}
                      color={getStatusColor(document.status) as any}
                      size="small"
                    />
                    {!bulkSelectMode && (
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuOpen(e, document);
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    )}
                  </Box>
                </ListItem>
                {index < sortedDocuments.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Document Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedDocument) {
            navigate(`/documents/${selectedDocument.id}/edit`);
          }
          handleMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedDocument) {
            analyzeDocumentMutation.mutate(selectedDocument.id);
          }
          handleMenuClose();
        }}>
          <AIIcon sx={{ mr: 1 }} />
          AI Analysis
        </MenuItem>
        <MenuItem onClick={handleDownloadDocument}>
          <DownloadIcon sx={{ mr: 1 }} />
          Download
        </MenuItem>
        <MenuItem onClick={handleDeleteDocument} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Document Title"
            fullWidth
            variant="outlined"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          {uploadedFile && (
            <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 1, backgroundColor: 'grey.50' }}>
              <Typography variant="body2">
                <strong>File:</strong> {uploadedFile.name}
              </Typography>
              <Typography variant="body2">
                <strong>Size:</strong> {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!uploadedFile || !uploadTitle.trim() || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for Mobile */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', sm: 'none' },
        }}
        onClick={() => setUploadDialogOpen(true)}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Documents;
