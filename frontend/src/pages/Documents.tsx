import React, { useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActions, Grid, Chip, IconButton,
  Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Fab, Paper, List, ListItem, ListItemText, ListItemIcon, Divider,
  Checkbox, Pagination, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, MoreVert as MoreIcon, Edit as EditIcon, Send as SendIcon,
  Download as DownloadIcon, Delete as DeleteIcon, Visibility as ViewIcon,
  CloudUpload as UploadIcon, SmartToy as AIIcon, Search as SearchIcon,
  ViewList as ListViewIcon, ViewModule as GridViewIcon, SelectAll as SelectAllIcon,
  Share as ShareIcon, Archive as ArchiveIcon, Description as DocumentIcon,
  Close as CloseIcon, GetApp as ExportIcon, PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { documentAPI, aiAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { DocumentListSkeleton } from '../components/Skeletons';

const Documents: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showInfo } = useToast();
  const [searchParams] = useSearchParams();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [detailDialog, setDetailDialog] = useState(false);
  const [detailDoc, setDetailDoc] = useState<any>(null);
  const [bulkUpdateDialog, setBulkUpdateDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

  const { data: documentsResponse, isLoading, error } = useQuery({
    queryKey: ['documents', page, limit, searchQuery, filterStatus, sortBy],
    queryFn: () => documentAPI.getDocuments({
      page,
      limit,
      search: searchQuery,
      status: filterStatus !== 'all' ? filterStatus : undefined,
      sortBy,
      sortOrder: 'desc',
    }),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => documentAPI.uploadDocument(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setUploadDialogOpen(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadedFile(null);
      showSuccess('Document uploaded successfully');
    },
    onError: () => showError('Failed to upload document'),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => documentAPI.deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess('Document deleted');
      setDetailDialog(false);
    },
    onError: () => showError('Failed to delete document'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => documentAPI.bulkDelete(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess(`${data.data.deletedCount} document(s) deleted`);
      setSelectedDocuments(new Set());
      setBulkSelectMode(false);
    },
    onError: () => showError('Bulk delete failed'),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: any }) =>
      documentAPI.bulkUpdate(ids, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess(`${data.data.updatedCount} document(s) updated`);
      setSelectedDocuments(new Set());
      setBulkSelectMode(false);
      setBulkUpdateDialog(false);
    },
    onError: () => showError('Bulk update failed'),
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
    if (uploadDescription) formData.append('description', uploadDescription);
    uploadMutation.mutate(formData);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, document: any) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedDocument(document);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedDocument(null);
  };

  const handleRowClick = (doc: any) => {
    setDetailDoc(doc);
    setDetailDialog(true);
  };

  const handleExportCSV = async () => {
    try {
      const response = await documentAPI.exportCSV({ status: filterStatus !== 'all' ? filterStatus : undefined });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents-export-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('CSV exported');
    } catch {
      showError('CSV export failed');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await documentAPI.exportPDF({ status: filterStatus !== 'all' ? filterStatus : undefined });
      const data = response.data;
      // Create a simple PDF-style HTML and print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Documents Export</title>
          <style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#1976d2;color:white}tr:nth-child(even){background:#f2f2f2}h1{color:#333}</style>
          </head><body>
          <h1>Documents Export</h1>
          <p>Date: ${new Date(data.exportDate).toLocaleString()}</p>
          <p>Total: ${data.totalDocuments} documents</p>
          <table><tr><th>Title</th><th>Status</th><th>Sender</th><th>Signatures</th><th>Created</th></tr>
          ${data.documents.map((d: any) => `<tr><td>${d.title}</td><td>${d.status}</td><td>${d.sender}</td><td>${d.signatureCount}</td><td>${new Date(d.createdAt).toLocaleDateString()}</td></tr>`).join('')}
          </table></body></html>`);
        printWindow.document.close();
        printWindow.print();
      }
      showSuccess('PDF export ready');
    } catch {
      showError('PDF export failed');
    }
  };

  const handleBulkDelete = () => {
    if (selectedDocuments.size === 0) return;
    bulkDeleteMutation.mutate(Array.from(selectedDocuments));
  };

  const handleBulkUpdate = () => {
    if (selectedDocuments.size === 0 || !bulkStatus) return;
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedDocuments),
      updates: { status: bulkStatus },
    });
  };

  const toggleSelectAll = () => {
    const docs = documentsResponse?.data?.data || [];
    if (selectedDocuments.size === docs.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(docs.map((d: any) => d.id)));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'SENT': case 'IN_PROGRESS': return 'warning';
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  if (isLoading) return <DocumentListSkeleton />;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">Failed to load documents.</Alert></Box>;

  const documentList = documentsResponse?.data?.data || [];
  const pagination = documentsResponse?.data?.pagination;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Documents ({pagination?.total || 0})</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Export CSV">
            <Button variant="outlined" size="small" startIcon={<ExportIcon />} onClick={handleExportCSV}>CSV</Button>
          </Tooltip>
          <Tooltip title="Export PDF">
            <Button variant="outlined" size="small" startIcon={<PdfIcon />} onClick={handleExportPDF}>PDF</Button>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<SelectAllIcon />}
            onClick={() => { setBulkSelectMode(!bulkSelectMode); setSelectedDocuments(new Set()); }}
            color={bulkSelectMode ? 'primary' : 'inherit'}
          >
            {bulkSelectMode ? 'Cancel' : 'Select'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUploadDialogOpen(true)}>
            Upload
          </Button>
        </Box>
      </Box>

      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth placeholder="Search documents..." value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
              size="small"
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              select fullWidth label="Status" value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
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
              select fullWidth label="Sort by" value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              size="small"
            >
              <MenuItem value="createdAt">Date</MenuItem>
              <MenuItem value="title">Name</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <IconButton onClick={() => setViewMode('list')} color={viewMode === 'list' ? 'primary' : 'default'}>
                <ListViewIcon />
              </IconButton>
              <IconButton onClick={() => setViewMode('grid')} color={viewMode === 'grid' ? 'primary' : 'default'}>
                <GridViewIcon />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Bulk Actions Bar */}
      {bulkSelectMode && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: selectedDocuments.size > 0 ? 'primary.light' : 'grey.100', color: selectedDocuments.size > 0 ? 'primary.contrastText' : 'inherit' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button size="small" onClick={toggleSelectAll} sx={{ color: 'inherit' }}>
                {selectedDocuments.size === documentList.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Typography>{selectedDocuments.size} selected</Typography>
            </Box>
            {selectedDocuments.size > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<EditIcon />} onClick={() => setBulkUpdateDialog(true)} sx={{ color: 'inherit' }}>
                  Update Status
                </Button>
                <Button size="small" startIcon={<DeleteIcon />} onClick={handleBulkDelete} sx={{ color: 'inherit' }}
                  disabled={bulkDeleteMutation.isPending}>
                  Delete ({selectedDocuments.size})
                </Button>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Drop Zone */}
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed #ccc', borderRadius: 2, p: 3, mb: 3, textAlign: 'center',
          cursor: 'pointer', backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        <input {...getInputProps()} />
        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive ? 'Drop files here' : 'Drag & drop documents here'}
        </Typography>
        <Typography variant="body2" color="text.secondary">Supports PDF, DOC, and DOCX</Typography>
      </Box>

      {/* Documents Display */}
      {documentList.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchQuery || filterStatus !== 'all' ? 'No documents match your filters' : 'No documents yet'}
          </Typography>
          {!searchQuery && filterStatus === 'all' && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUploadDialogOpen(true)}>
              Upload Your First Document
            </Button>
          )}
        </Box>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={3}>
          {documentList.map((document: any) => (
            <Grid item xs={12} sm={6} md={4} key={document.id}>
              <Card
                sx={{
                  height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
                  cursor: 'pointer', '&:hover': { boxShadow: 4 },
                }}
                onClick={() => handleRowClick(document)}
              >
                {bulkSelectMode && (
                  <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
                    <Checkbox
                      checked={selectedDocuments.has(document.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newSet = new Set(selectedDocuments);
                        e.target.checked ? newSet.add(document.id) : newSet.delete(document.id);
                        setSelectedDocuments(newSet);
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
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, document)}>
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
                    <Chip label={document.status} color={getStatusColor(document.status) as any} size="small" />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Created: {new Date(document.createdAt).toLocaleDateString()}
                  </Typography>
                  {document._count?.signatures > 0 && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Signatures: {document.signatures?.filter((s: any) => s.status === 'SIGNED').length} / {document._count.signatures}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<ViewIcon />}
                    onClick={(e) => { e.stopPropagation(); navigate(`/documents/${document.id}/edit`); }}>
                    View
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper>
          <List>
            {documentList.map((document: any, index: number) => (
              <React.Fragment key={document.id}>
                <ListItem
                  sx={{ '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }}
                  onClick={() => handleRowClick(document)}
                >
                  {bulkSelectMode && (
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedDocuments.has(document.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const newSet = new Set(selectedDocuments);
                          e.target.checked ? newSet.add(document.id) : newSet.delete(document.id);
                          setSelectedDocuments(newSet);
                        }}
                      />
                    </ListItemIcon>
                  )}
                  <ListItemIcon><DocumentIcon /></ListItemIcon>
                  <ListItemText
                    primary={document.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" component="span">{document.description}</Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          Created: {new Date(document.createdAt).toLocaleDateString()}
                          {document.sender && ` | By: ${document.sender.firstName} ${document.sender.lastName}`}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={document.status} color={getStatusColor(document.status) as any} size="small" />
                    {!bulkSelectMode && (
                      <IconButton onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, document); }}>
                        <MoreIcon />
                      </IconButton>
                    )}
                  </Box>
                </ListItem>
                {index < documentList.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Actions Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={() => { if (selectedDocument) navigate(`/documents/${selectedDocument.id}/edit`); handleMenuClose(); }}>
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { if (selectedDocument) { aiAPI.analyzeDocument(selectedDocument.id); showInfo('Running AI analysis...'); } handleMenuClose(); }}>
          <AIIcon sx={{ mr: 1 }} /> AI Analysis
        </MenuItem>
        <MenuItem onClick={() => { if (selectedDocument) { window.open(selectedDocument.fileUrl, '_blank'); showInfo('Download started'); } handleMenuClose(); }}>
          <DownloadIcon sx={{ mr: 1 }} /> Download
        </MenuItem>
        <MenuItem onClick={() => { if (selectedDocument) deleteDocumentMutation.mutate(selectedDocument.id); handleMenuClose(); }} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Row Detail Dialog */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Document Details
            <IconButton onClick={() => setDetailDialog(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        {detailDoc && (
          <DialogContent>
            <Typography variant="h6" gutterBottom>{detailDoc.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {detailDoc.description || 'No description'}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box><Chip label={detailDoc.status} size="small" color={getStatusColor(detailDoc.status) as any} /></Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Created</Typography>
                <Typography variant="body2">{new Date(detailDoc.createdAt).toLocaleDateString()}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Sender</Typography>
                <Typography variant="body2">{detailDoc.sender?.firstName} {detailDoc.sender?.lastName}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">File Size</Typography>
                <Typography variant="body2">{detailDoc.fileSize ? `${Math.round(detailDoc.fileSize / 1024)} KB` : '-'}</Typography>
              </Grid>
            </Grid>
            {detailDoc.signatures?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Signers:</Typography>
                {detailDoc.signatures.map((sig: any, i: number) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">{sig.signerName} ({sig.signerEmail})</Typography>
                    <Chip label={sig.status} size="small" color={sig.status === 'SIGNED' ? 'success' : sig.status === 'DECLINED' ? 'error' : 'default'} />
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button variant="outlined" startIcon={<EditIcon />}
            onClick={() => { navigate(`/documents/${detailDoc?.id}/edit`); setDetailDialog(false); }}>
            Edit
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />}
            onClick={() => { if (detailDoc) deleteDocumentMutation.mutate(detailDoc.id); }}
            disabled={deleteDocumentMutation.isPending}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={bulkUpdateDialog} onClose={() => setBulkUpdateDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Update {selectedDocuments.size} Document(s)</DialogTitle>
        <DialogContent>
          <TextField
            select fullWidth label="New Status" value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)} sx={{ mt: 1 }}
          >
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkUpdateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkUpdate} disabled={!bulkStatus || bulkUpdateMutation.isPending}>
            {bulkUpdateMutation.isPending ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus margin="dense" label="Document Title" fullWidth variant="outlined"
            value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} sx={{ mb: 2 }}
          />
          <TextField
            margin="dense" label="Description (Optional)" fullWidth multiline rows={3}
            variant="outlined" value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)} sx={{ mb: 2 }}
          />
          {uploadedFile && (
            <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 1, backgroundColor: 'grey.50' }}>
              <Typography variant="body2"><strong>File:</strong> {uploadedFile.name}</Typography>
              <Typography variant="body2"><strong>Size:</strong> {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload}
            disabled={!uploadedFile || !uploadTitle.trim() || uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Fab
        color="primary" aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16, display: { xs: 'flex', sm: 'none' } }}
        onClick={() => setUploadDialogOpen(true)}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Documents;
