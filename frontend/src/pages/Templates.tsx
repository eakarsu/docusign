import React, { useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActions, Grid, Chip,
  IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, Fab, Avatar, Pagination,
  Divider, Paper, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, MoreVert as MoreIcon, Edit as EditIcon, Delete as DeleteIcon,
  FileCopy as CopyIcon, Visibility as ViewIcon, Business as BusinessIcon,
  Description as ContractIcon, Security as NDIcon, Assignment as AgreementIcon,
  Close as CloseIcon, GetApp as ExportIcon, Save as SaveIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templateAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { DocumentListSkeleton } from '../components/Skeletons';

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showInfo } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [detailDialog, setDetailDialog] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState<any>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editData, setEditData] = useState({ name: '', description: '' });
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTemplate, setNewTemplate] = useState({
    name: '', description: '', category: 'contract',
  });

  const { data: templatesResponse, isLoading } = useQuery({
    queryKey: ['templates', page, searchQuery],
    queryFn: () => templateAPI.getTemplates({ page, limit: 12, search: searchQuery }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => templateAPI.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      showSuccess('Template deleted');
      setDetailDialog(false);
    },
    onError: () => showError('Failed to delete template'),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => templateAPI.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      showSuccess('Template updated');
      setEditDialog(false);
    },
    onError: () => showError('Failed to update template'),
  });

  const categories = [
    { value: 'contract', label: 'Contract', icon: <ContractIcon /> },
    { value: 'nda', label: 'NDA', icon: <NDIcon /> },
    { value: 'employment', label: 'Employment', icon: <BusinessIcon /> },
    { value: 'vendor', label: 'Vendor', icon: <AgreementIcon /> },
    { value: 'real-estate', label: 'Real Estate', icon: <BusinessIcon /> },
    { value: 'partnership', label: 'Partnership', icon: <BusinessIcon /> },
  ];

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      contract: '#1976d2', nda: '#d32f2f', employment: '#388e3c',
      vendor: '#f57c00', 'real-estate': '#7b1fa2', partnership: '#0288d1',
    };
    return colors[category] || '#1976d2';
  };

  const handleRowClick = (template: any) => {
    setDetailTemplate(template);
    setDetailDialog(true);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, template: any) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedTemplate(template);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedTemplate(null);
  };

  const handleCreateTemplate = () => {
    showInfo('Template creation - connect to your file upload flow');
    setCreateDialogOpen(false);
    setNewTemplate({ name: '', description: '', category: 'contract' });
  };

  const handleExportCSV = async () => {
    try {
      const response = await templateAPI.exportCSV();
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `templates-export-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('CSV exported');
    } catch {
      showError('CSV export failed');
    }
  };

  const handleOpenEdit = (template: any) => {
    setEditData({ name: template.name, description: template.description || '' });
    setSelectedTemplate(template);
    setEditDialog(true);
    handleMenuClose();
  };

  if (isLoading) return <DocumentListSkeleton />;

  const templates = templatesResponse?.data?.data || templatesResponse?.data || [];
  const pagination = templatesResponse?.data?.pagination;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Document Templates ({pagination?.total || templates.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small" placeholder="Search..." value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            sx={{ width: 200 }}
          />
          <Tooltip title="Export CSV">
            <Button variant="outlined" size="small" startIcon={<ExportIcon />} onClick={handleExportCSV}>
              CSV
            </Button>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            Create Template
          </Button>
        </Box>
      </Box>

      {/* Category Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {categories.map((category) => (
          <Grid item xs={6} sm={4} md={2} key={category.value}>
            <Card
              sx={{ textAlign: 'center', p: 1, cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
              onClick={() => showInfo(`Filtering by ${category.label}`)}
            >
              <Avatar
                sx={{ bgcolor: getCategoryColor(category.value), mx: 'auto', mb: 1, width: 40, height: 40 }}
              >
                {category.icon}
              </Avatar>
              <Typography variant="body2" fontWeight="bold">{category.label}</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Templates Grid */}
      <Grid container spacing={3}>
        {templates.map((template: any) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card
              sx={{
                height: '100%', display: 'flex', flexDirection: 'column',
                cursor: 'pointer', '&:hover': { boxShadow: 4 },
              }}
              onClick={() => handleRowClick(template)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                    {template.name}
                  </Typography>
                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, template)}>
                    <MoreIcon />
                  </IconButton>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {template.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip label={template.isPublic ? 'Public' : 'Private'} size="small"
                    color={template.isPublic ? 'success' : 'default'} variant="outlined" />
                </Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Created: {new Date(template.createdAt).toLocaleDateString()}
                </Typography>
                {template.creator && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    By: {template.creator.firstName} {template.creator.lastName}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button size="small" variant="contained"
                  onClick={(e) => { e.stopPropagation(); navigate('/documents'); showInfo('Use template to create document'); }}>
                  Use Template
                </Button>
                <Button size="small" startIcon={<ViewIcon />}
                  onClick={(e) => { e.stopPropagation(); handleRowClick(template); }}>
                  Preview
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={pagination.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" showFirstButton showLastButton />
        </Box>
      )}

      {/* Template Actions Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={() => handleOpenEdit(selectedTemplate)}>
          <EditIcon sx={{ mr: 1 }} /> Edit Template
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <CopyIcon sx={{ mr: 1 }} /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => { if (selectedTemplate) deleteTemplateMutation.mutate(selectedTemplate.id); handleMenuClose(); }} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Row Detail Dialog */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Template Details
            <IconButton onClick={() => setDetailDialog(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        {detailTemplate && (
          <DialogContent>
            <Typography variant="h6" gutterBottom>{detailTemplate.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {detailTemplate.description || 'No description'}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Visibility</Typography>
                <Box><Chip label={detailTemplate.isPublic ? 'Public' : 'Private'} size="small" /></Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Created</Typography>
                <Typography variant="body2">{new Date(detailTemplate.createdAt).toLocaleDateString()}</Typography>
              </Grid>
              {detailTemplate.creator && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Creator</Typography>
                  <Typography variant="body2">{detailTemplate.creator.firstName} {detailTemplate.creator.lastName} ({detailTemplate.creator.email})</Typography>
                </Grid>
              )}
            </Grid>
          </DialogContent>
        )}
        <DialogActions>
          <Button variant="outlined" startIcon={<EditIcon />}
            onClick={() => { handleOpenEdit(detailTemplate); setDetailDialog(false); }}>
            Edit
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />}
            onClick={() => { if (detailTemplate) deleteTemplateMutation.mutate(detailTemplate.id); }}
            disabled={deleteTemplateMutation.isPending}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Template</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Template Name" value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth label="Description" multiline rows={3} value={editData.description}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon />}
            onClick={() => { if (selectedTemplate) updateTemplateMutation.mutate({ id: selectedTemplate.id, data: editData }); }}
            disabled={updateTemplateMutation.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus margin="dense" label="Template Name" fullWidth variant="outlined"
            value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense" label="Description" fullWidth multiline rows={3} variant="outlined"
            value={newTemplate.description} onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={newTemplate.category} label="Category"
              onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}>
              {categories.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {category.icon} {category.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTemplate} disabled={!newTemplate.name.trim()}>
            Create Template
          </Button>
        </DialogActions>
      </Dialog>

      <Fab
        color="primary" aria-label="add template"
        sx={{ position: 'fixed', bottom: 16, right: 16, display: { xs: 'flex', sm: 'none' } }}
        onClick={() => setCreateDialogOpen(true)}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Templates;
