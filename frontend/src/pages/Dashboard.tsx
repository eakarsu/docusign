import React, { useState } from 'react';
import {
  Box, Grid, Paper, Typography, Card, CardContent, CardActions, Button, Chip,
  IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, ListItemIcon, Avatar, Divider,
  Alert, Badge, Fab, Tooltip,
} from '@mui/material';
import {
  Description as DocumentIcon, Send as SendIcon, Edit as EditIcon,
  CheckCircle as CompleteIcon, Add as AddIcon, MoreVert as MoreIcon,
  Notifications as NotificationIcon, Analytics as AnalyticsIcon,
  Refresh as RefreshIcon, FilterList as FilterIcon, Download as DownloadIcon,
  Delete as DeleteIcon, Close as CloseIcon, Article as TemplateIcon,
  SmartToy as AIIcon, Person as PersonIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentAPI, aiAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { DashboardSkeleton } from '../components/Skeletons';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showInfo } = useToast();
  const [quickActionDialog, setQuickActionDialog] = useState(false);
  const [filterMenu, setFilterMenu] = useState<null | HTMLElement>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [documentMenu, setDocumentMenu] = useState<null | HTMLElement>(null);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [detailDialog, setDetailDialog] = useState(false);
  const [detailDocument, setDetailDocument] = useState<any>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentAPI.getDocuments({ page: 1, limit: 100 }),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => documentAPI.deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess('Document deleted successfully');
      setDetailDialog(false);
    },
    onError: () => {
      showError('Failed to delete document');
    },
  });

  const analyzeDocumentMutation = useMutation({
    mutationFn: (documentId: string) => aiAPI.analyzeDocument(documentId),
    onSuccess: () => {
      showSuccess('AI analysis complete');
    },
    onError: () => {
      showError('AI analysis failed');
    },
  });

  const notifications = [
    { id: 1, message: 'Service Agreement signed by John Doe', time: '2 hours ago', type: 'success' },
    { id: 2, message: 'NDA Document reminder sent', time: '4 hours ago', type: 'info' },
    { id: 3, message: 'Contract Amendment needs review', time: '1 day ago', type: 'warning' },
  ];

  const analytics = {
    weeklySignatures: 12,
    avgCompletionTime: '2.3 days',
    successRate: '94%',
    pendingActions: 3,
  };

  const stats = React.useMemo(() => {
    if (!documents?.data?.data) return { total: 0, pending: 0, completed: 0, draft: 0 };
    const docs = documents.data.data;
    return {
      total: docs.length,
      pending: docs.filter((d: any) => d.status === 'SENT' || d.status === 'IN_PROGRESS').length,
      completed: docs.filter((d: any) => d.status === 'COMPLETED').length,
      draft: docs.filter((d: any) => d.status === 'DRAFT').length,
    };
  }, [documents]);

  const recentDocuments = documents?.data?.data?.slice(0, 5) || [];

  // Card click handlers - navigate to the appropriate section
  const handleCardClick = (section: string) => {
    switch (section) {
      case 'total':
        navigate('/documents');
        showInfo('Viewing all documents');
        break;
      case 'pending':
        navigate('/documents?status=SENT');
        showInfo('Viewing pending documents');
        break;
      case 'completed':
        navigate('/documents?status=COMPLETED');
        showInfo('Viewing completed documents');
        break;
      case 'draft':
        navigate('/documents?status=DRAFT');
        showInfo('Viewing draft documents');
        break;
    }
  };

  // Row click handler - show detail dialog
  const handleRowClick = (doc: any) => {
    setDetailDocument(doc);
    setDetailDialog(true);
  };

  const handleDocumentMenuOpen = (event: React.MouseEvent<HTMLElement>, document: any) => {
    event.stopPropagation();
    setDocumentMenu(event.currentTarget);
    setSelectedDocument(document);
  };

  const handleDocumentMenuClose = () => {
    setDocumentMenu(null);
    setSelectedDocument(null);
  };

  const handleDeleteDocument = () => {
    if (selectedDocument) {
      deleteDocumentMutation.mutate(selectedDocument.id);
    }
    handleDocumentMenuClose();
  };

  const handleAnalyzeDocument = () => {
    if (selectedDocument) {
      analyzeDocumentMutation.mutate(selectedDocument.id);
    }
    handleDocumentMenuClose();
  };

  const handleDownloadDocument = () => {
    if (selectedDocument) {
      window.open(selectedDocument.fileUrl, '_blank');
      showInfo('Download started');
    }
    handleDocumentMenuClose();
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.firstName}!
      </Typography>

      {/* Stats Cards - CLICKABLE */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { key: 'total', label: 'Total Documents', value: stats.total, icon: <DocumentIcon color="primary" sx={{ mr: 2 }} />, color: 'primary.main' },
          { key: 'pending', label: 'Pending Signatures', value: stats.pending, icon: <SendIcon color="warning" sx={{ mr: 2 }} />, color: 'warning.main' },
          { key: 'completed', label: 'Completed', value: stats.completed, icon: <CompleteIcon color="success" sx={{ mr: 2 }} />, color: 'success.main' },
          { key: 'draft', label: 'Drafts', value: stats.draft, icon: <EditIcon color="info" sx={{ mr: 2 }} />, color: 'info.main' },
        ].map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.key}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
              }}
              onClick={() => handleCardClick(stat.key)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {stat.icon}
                  <Box>
                    <Typography color="textSecondary" gutterBottom>{stat.label}</Typography>
                    <Typography variant="h5">{stat.value}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Documents with clickable rows */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Recent Documents</Typography>
              <Box>
                <IconButton onClick={(e) => setFilterMenu(e.currentTarget)}>
                  <FilterIcon />
                </IconButton>
                <IconButton onClick={() => { queryClient.invalidateQueries({ queryKey: ['documents'] }); showInfo('Refreshed'); }}>
                  <RefreshIcon />
                </IconButton>
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setQuickActionDialog(true)}>
                  New
                </Button>
              </Box>
            </Box>

            {recentDocuments.length === 0 ? (
              <Alert severity="info">No documents yet. Upload your first document to get started!</Alert>
            ) : (
              <Grid container spacing={2}>
                {recentDocuments.map((doc: any) => (
                  <Grid item xs={12} key={doc.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s',
                        '&:hover': { boxShadow: 3 },
                      }}
                      onClick={() => handleRowClick(doc)}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" noWrap>{doc.title}</Typography>
                            <Typography color="textSecondary" variant="body2">
                              Created: {new Date(doc.createdAt).toLocaleDateString()}
                            </Typography>
                            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                              <Chip
                                label={doc.status}
                                color={
                                  doc.status === 'COMPLETED' ? 'success' :
                                  doc.status === 'SENT' || doc.status === 'IN_PROGRESS' ? 'warning' : 'default'
                                }
                                size="small"
                              />
                            </Box>
                          </Box>
                          <IconButton size="small" onClick={(e) => handleDocumentMenuOpen(e, doc)}>
                            <MoreIcon />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AnalyticsIcon /> Analytics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">{analytics.weeklySignatures}</Typography>
                  <Typography variant="caption">This Week</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">{analytics.successRate}</Typography>
                  <Typography variant="caption">Success Rate</Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Avg. completion: {analytics.avgCompletionTime}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Recent Activity</Typography>
              <Badge badgeContent={notifications.length} color="primary">
                <NotificationIcon />
              </Badge>
            </Box>
            <List dense>
              {notifications.map((notification) => (
                <ListItem key={notification.id} divider>
                  <ListItemIcon>
                    <Avatar
                      sx={{
                        width: 24, height: 24,
                        bgcolor: notification.type === 'success' ? 'success.main' :
                          notification.type === 'warning' ? 'warning.main' : 'info.main'
                      }}
                    >
                      {notification.type === 'success' ? '✓' : notification.type === 'warning' ? '!' : 'i'}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={notification.message}
                    secondary={notification.time}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Filter Menu */}
      <Menu anchorEl={filterMenu} open={Boolean(filterMenu)} onClose={() => setFilterMenu(null)}>
        <MenuItem onClick={() => { setSelectedTimeRange('7d'); setFilterMenu(null); }}>Last 7 days</MenuItem>
        <MenuItem onClick={() => { setSelectedTimeRange('30d'); setFilterMenu(null); }}>Last 30 days</MenuItem>
        <MenuItem onClick={() => { setSelectedTimeRange('90d'); setFilterMenu(null); }}>Last 90 days</MenuItem>
      </Menu>

      {/* Quick Action Dialog */}
      <Dialog open={quickActionDialog} onClose={() => setQuickActionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Quick Actions</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth variant="outlined" startIcon={<AddIcon />}
                onClick={() => { setQuickActionDialog(false); navigate('/documents'); }}
                sx={{ p: 2, height: 80, flexDirection: 'column' }}
              >
                <Typography variant="subtitle2">Upload Document</Typography>
                <Typography variant="caption" color="text.secondary">Upload PDF, DOC, or DOCX</Typography>
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth variant="outlined" startIcon={<TemplateIcon />}
                onClick={() => { setQuickActionDialog(false); navigate('/templates'); }}
                sx={{ p: 2, height: 80, flexDirection: 'column' }}
              >
                <Typography variant="subtitle2">Browse Templates</Typography>
                <Typography variant="caption" color="text.secondary">Use a reusable template</Typography>
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth variant="outlined" startIcon={<AIIcon />}
                onClick={() => { setQuickActionDialog(false); navigate('/ai-assistant'); }}
                sx={{ p: 2, height: 80, flexDirection: 'column' }}
              >
                <Typography variant="subtitle2">AI Assistant</Typography>
                <Typography variant="caption" color="text.secondary">Generate with AI</Typography>
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth variant="outlined" startIcon={<PersonIcon />}
                onClick={() => { setQuickActionDialog(false); navigate('/profile'); }}
                sx={{ p: 2, height: 80, flexDirection: 'column' }}
              >
                <Typography variant="subtitle2">Profile Settings</Typography>
                <Typography variant="caption" color="text.secondary">Manage your account</Typography>
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickActionDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Document Actions Menu */}
      <Menu anchorEl={documentMenu} open={Boolean(documentMenu)} onClose={handleDocumentMenuClose}>
        <MenuItem onClick={() => {
          if (selectedDocument) navigate(`/documents/${selectedDocument.id}/edit`);
          handleDocumentMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={handleAnalyzeDocument}>
          <AnalyticsIcon sx={{ mr: 1 }} /> AI Analysis
        </MenuItem>
        <MenuItem onClick={handleDownloadDocument}>
          <DownloadIcon sx={{ mr: 1 }} /> Download
        </MenuItem>
        <MenuItem onClick={handleDeleteDocument} sx={{ color: 'error.main' }}>
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
        {detailDocument && (
          <DialogContent>
            <Typography variant="h6" gutterBottom>{detailDocument.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {detailDocument.description || 'No description'}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box><Chip label={detailDocument.status} size="small" color={
                  detailDocument.status === 'COMPLETED' ? 'success' :
                  detailDocument.status === 'SENT' ? 'warning' : 'default'
                } /></Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Created</Typography>
                <Typography variant="body2">{new Date(detailDocument.createdAt).toLocaleDateString()}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Sender</Typography>
                <Typography variant="body2">{detailDocument.sender?.firstName} {detailDocument.sender?.lastName}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Signatures</Typography>
                <Typography variant="body2">
                  {detailDocument.signatures?.filter((s: any) => s.status === 'SIGNED').length || 0} / {detailDocument.signatures?.length || 0}
                </Typography>
              </Grid>
            </Grid>
            {detailDocument.signatures?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Signers:</Typography>
                {detailDocument.signatures.map((sig: any, i: number) => (
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
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => {
              navigate(`/documents/${detailDocument?.id}/edit`);
              setDetailDialog(false);
            }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => {
              if (detailDocument) deleteDocumentMutation.mutate(detailDocument.id);
            }}
            disabled={deleteDocumentMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Fab
        color="primary"
        aria-label="create document"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => navigate('/documents/new/edit')}
      >
        <DocumentIcon />
      </Fab>
    </Box>
  );
};

export default Dashboard;
