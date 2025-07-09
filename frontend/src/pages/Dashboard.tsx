import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Divider,
  Alert,
  Tooltip,
  Badge,
  Fab,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Send as SendIcon,
  Edit as EditIcon,
  CheckCircle as CompleteIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { documentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quickActionDialog, setQuickActionDialog] = useState(false);
  const [notificationMenu, setNotificationMenu] = useState<null | HTMLElement>(null);
  const [filterMenu, setFilterMenu] = useState<null | HTMLElement>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  
  // Mock data for demo - replace with real API calls when backend is ready
  const documents = {
    data: [
      {
        id: '1',
        title: 'Service Agreement',
        status: 'COMPLETED',
        createdAt: '2024-01-15T10:00:00Z',
        priority: 'high',
        dueDate: '2024-01-20T10:00:00Z'
      },
      {
        id: '2',
        title: 'NDA Document',
        status: 'SENT',
        createdAt: '2024-01-14T10:00:00Z',
        priority: 'medium',
        dueDate: '2024-01-18T10:00:00Z'
      },
      {
        id: '3',
        title: 'Contract Amendment',
        status: 'DRAFT',
        createdAt: '2024-01-13T10:00:00Z',
        priority: 'low',
        dueDate: '2024-01-25T10:00:00Z'
      }
    ]
  };
  const isLoading = false;

  const notifications = [
    { id: 1, message: 'Service Agreement signed by John Doe', time: '2 hours ago', type: 'success' },
    { id: 2, message: 'NDA Document reminder sent', time: '4 hours ago', type: 'info' },
    { id: 3, message: 'Contract Amendment needs review', time: '1 day ago', type: 'warning' },
  ];

  const analytics = {
    weeklySignatures: 12,
    avgCompletionTime: '2.3 days',
    successRate: '94%',
    pendingActions: 3
  };

  const stats = React.useMemo(() => {
    if (!documents?.data) return { total: 0, pending: 0, completed: 0, draft: 0 };
    
    const docs = documents.data;
    return {
      total: docs.length,
      pending: docs.filter((d: any) => d.status === 'SENT' || d.status === 'IN_PROGRESS').length,
      completed: docs.filter((d: any) => d.status === 'COMPLETED').length,
      draft: docs.filter((d: any) => d.status === 'DRAFT').length,
    };
  }, [documents]);

  const recentDocuments = documents?.data?.slice(0, 5) || [];

  if (isLoading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.firstName}!
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DocumentIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Documents
                  </Typography>
                  <Typography variant="h5">{stats.total}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SendIcon color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending Signatures
                  </Typography>
                  <Typography variant="h5">{stats.pending}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CompleteIcon color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Completed
                  </Typography>
                  <Typography variant="h5">{stats.completed}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <EditIcon color="info" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Drafts
                  </Typography>
                  <Typography variant="h5">{stats.draft}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Dashboard Content */}
      <Grid container spacing={3}>
        {/* Recent Documents with Actions */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Recent Documents
              </Typography>
              <Box>
                <IconButton onClick={(e) => setFilterMenu(e.currentTarget)}>
                  <FilterIcon />
                </IconButton>
                <IconButton onClick={() => window.location.reload()}>
                  <RefreshIcon />
                </IconButton>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setQuickActionDialog(true)}
                >
                  New
                </Button>
              </Box>
            </Box>
            
            {recentDocuments.length === 0 ? (
              <Alert severity="info">
                No documents yet. Upload your first document to get started!
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {recentDocuments.map((doc: any) => (
                  <Grid item xs={12} key={doc.id}>
                    <Card variant="outlined" sx={{ '&:hover': { boxShadow: 2 } }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" noWrap>
                              {doc.title}
                            </Typography>
                            <Typography color="textSecondary" variant="body2">
                              Created: {new Date(doc.createdAt).toLocaleDateString()}
                            </Typography>
                            {doc.dueDate && (
                              <Typography color="textSecondary" variant="body2">
                                Due: {new Date(doc.dueDate).toLocaleDateString()}
                              </Typography>
                            )}
                            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                              <Chip
                                label={doc.status}
                                color={
                                  doc.status === 'COMPLETED' ? 'success' :
                                  doc.status === 'SENT' || doc.status === 'IN_PROGRESS' ? 'warning' :
                                  'default'
                                }
                                size="small"
                              />
                              <Chip
                                label={doc.priority}
                                color={
                                  doc.priority === 'high' ? 'error' :
                                  doc.priority === 'medium' ? 'warning' :
                                  'default'
                                }
                                variant="outlined"
                                size="small"
                              />
                            </Box>
                          </Box>
                          <IconButton size="small">
                            <MoreIcon />
                          </IconButton>
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button size="small" onClick={() => navigate(`/documents/${doc.id}/edit`)}>
                          View
                        </Button>
                        {doc.status === 'DRAFT' && (
                          <Button size="small" color="primary">
                            Edit
                          </Button>
                        )}
                        {doc.status === 'SENT' && (
                          <Button size="small" color="secondary">
                            Remind
                          </Button>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>

        {/* Sidebar with Analytics and Notifications */}
        <Grid item xs={12} md={4}>
          {/* Quick Analytics */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AnalyticsIcon />
              Analytics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {analytics.weeklySignatures}
                  </Typography>
                  <Typography variant="caption">
                    This Week
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {analytics.successRate}
                  </Typography>
                  <Typography variant="caption">
                    Success Rate
                  </Typography>
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

          {/* Notifications */}
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Recent Activity
              </Typography>
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
                        width: 24,
                        height: 24,
                        bgcolor: 
                          notification.type === 'success' ? 'success.main' :
                          notification.type === 'warning' ? 'warning.main' :
                          'info.main'
                      }}
                    >
                      {notification.type === 'success' ? '✓' : 
                       notification.type === 'warning' ? '!' : 'i'}
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
      <Menu
        anchorEl={filterMenu}
        open={Boolean(filterMenu)}
        onClose={() => setFilterMenu(null)}
      >
        <MenuItem onClick={() => { setSelectedTimeRange('7d'); setFilterMenu(null); }}>
          Last 7 days
        </MenuItem>
        <MenuItem onClick={() => { setSelectedTimeRange('30d'); setFilterMenu(null); }}>
          Last 30 days
        </MenuItem>
        <MenuItem onClick={() => { setSelectedTimeRange('90d'); setFilterMenu(null); }}>
          Last 90 days
        </MenuItem>
      </Menu>

      {/* Quick Action Dialog */}
      <Dialog open={quickActionDialog} onClose={() => setQuickActionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Quick Actions</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  setQuickActionDialog(false);
                  navigate('/documents');
                }}
                sx={{ p: 2, height: 80, flexDirection: 'column' }}
              >
                <Typography variant="subtitle2">Upload Document</Typography>
                <Typography variant="caption" color="text.secondary">
                  Upload PDF, DOC, or DOCX
                </Typography>
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => {
                  setQuickActionDialog(false);
                  navigate('/templates');
                }}
                sx={{ p: 2, height: 80, flexDirection: 'column' }}
              >
                <Typography variant="subtitle2">Create Template</Typography>
                <Typography variant="caption" color="text.secondary">
                  Build reusable document
                </Typography>
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<DocumentIcon />}
                onClick={() => {
                  setQuickActionDialog(false);
                  // Create a new document and go directly to editor
                  navigate('/documents/new/edit');
                }}
                sx={{ p: 2, height: 60 }}
              >
                <Typography variant="subtitle1">Start Document Editor</Typography>
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickActionDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for Quick Document Creation */}
      <Fab
        color="primary"
        aria-label="create document"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => navigate('/documents/new/edit')}
      >
        <DocumentIcon />
      </Fab>
    </Box>
  );
};

export default Dashboard;
