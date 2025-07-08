import React from 'react';
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
} from '@mui/material';
import {
  Description as DocumentIcon,
  Send as SendIcon,
  Edit as EditIcon,
  CheckCircle as CompleteIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { documentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentAPI.getDocuments(),
  });

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

      {/* Recent Documents */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Documents
        </Typography>
        
        {recentDocuments.length === 0 ? (
          <Typography color="textSecondary">
            No documents yet. Upload your first document to get started!
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {recentDocuments.map((doc: any) => (
              <Grid item xs={12} md={6} key={doc.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" noWrap>
                      {doc.title}
                    </Typography>
                    <Typography color="textSecondary" gutterBottom>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </Typography>
                    <Chip
                      label={doc.status}
                      color={
                        doc.status === 'COMPLETED' ? 'success' :
                        doc.status === 'SENT' || doc.status === 'IN_PROGRESS' ? 'warning' :
                        'default'
                      }
                      size="small"
                    />
                  </CardContent>
                  <CardActions>
                    <Button size="small" href={`/documents/${doc.id}/edit`}>
                      View
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </Box>
  );
};

export default Dashboard;
