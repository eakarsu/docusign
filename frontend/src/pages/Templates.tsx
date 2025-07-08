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
  FormControl,
  InputLabel,
  Select,
  Fab,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CopyIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  Description as ContractIcon,
  Security as NDIcon,
  Assignment as AgreementIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: number;
  usageCount: number;
  createdAt: string;
  thumbnail?: string;
}

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'contract',
  });

  // Mock template data
  const templates: Template[] = [
    {
      id: '1',
      name: 'Service Agreement',
      description: 'Standard service agreement template with payment terms',
      category: 'contract',
      fields: 8,
      usageCount: 24,
      createdAt: '2024-01-10T10:00:00Z',
    },
    {
      id: '2',
      name: 'Non-Disclosure Agreement',
      description: 'Mutual NDA template for business partnerships',
      category: 'nda',
      fields: 6,
      usageCount: 18,
      createdAt: '2024-01-08T10:00:00Z',
    },
    {
      id: '3',
      name: 'Employment Contract',
      description: 'Standard employment agreement with benefits',
      category: 'employment',
      fields: 12,
      usageCount: 15,
      createdAt: '2024-01-05T10:00:00Z',
    },
    {
      id: '4',
      name: 'Vendor Agreement',
      description: 'Vendor service agreement with SLA terms',
      category: 'vendor',
      fields: 10,
      usageCount: 9,
      createdAt: '2024-01-03T10:00:00Z',
    },
    {
      id: '5',
      name: 'Lease Agreement',
      description: 'Residential lease agreement template',
      category: 'real-estate',
      fields: 15,
      usageCount: 7,
      createdAt: '2024-01-01T10:00:00Z',
    },
    {
      id: '6',
      name: 'Partnership Agreement',
      description: 'Business partnership agreement template',
      category: 'partnership',
      fields: 14,
      usageCount: 5,
      createdAt: '2023-12-28T10:00:00Z',
    },
  ];

  const categories = [
    { value: 'contract', label: 'Contract', icon: <ContractIcon /> },
    { value: 'nda', label: 'NDA', icon: <NDIcon /> },
    { value: 'employment', label: 'Employment', icon: <BusinessIcon /> },
    { value: 'vendor', label: 'Vendor', icon: <AgreementIcon /> },
    { value: 'real-estate', label: 'Real Estate', icon: <BusinessIcon /> },
    { value: 'partnership', label: 'Partnership', icon: <BusinessIcon /> },
  ];

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.icon || <ContractIcon />;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      contract: '#1976d2',
      nda: '#d32f2f',
      employment: '#388e3c',
      vendor: '#f57c00',
      'real-estate': '#7b1fa2',
      partnership: '#0288d1',
    };
    return colors[category] || '#1976d2';
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, template: Template) => {
    setMenuAnchor(event.currentTarget);
    setSelectedTemplate(template);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedTemplate(null);
  };

  const handleCreateTemplate = () => {
    console.log('Creating template:', newTemplate);
    setCreateDialogOpen(false);
    setNewTemplate({ name: '', description: '', category: 'contract' });
  };

  const handleUseTemplate = (template: Template) => {
    console.log('Using template:', template.id);
    // Navigate to document creation with template
    navigate('/documents');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Document Templates ({templates.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Template
        </Button>
      </Box>

      {/* Category Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {categories.map((category) => {
          const count = templates.filter(t => t.category === category.value).length;
          return (
            <Grid item xs={6} sm={4} md={2} key={category.value}>
              <Card sx={{ textAlign: 'center', p: 1 }}>
                <Avatar
                  sx={{
                    bgcolor: getCategoryColor(category.value),
                    mx: 'auto',
                    mb: 1,
                    width: 40,
                    height: 40,
                  }}
                >
                  {category.icon}
                </Avatar>
                <Typography variant="body2" fontWeight="bold">
                  {category.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {count} templates
                </Typography>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Templates Grid */}
      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      sx={{
                        bgcolor: getCategoryColor(template.category),
                        width: 32,
                        height: 32,
                      }}
                    >
                      {getCategoryIcon(template.category)}
                    </Avatar>
                    <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                      {template.name}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, template)}
                  >
                    <MoreIcon />
                  </IconButton>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {template.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={categories.find(c => c.value === template.category)?.label}
                    size="small"
                    sx={{ bgcolor: getCategoryColor(template.category), color: 'white' }}
                  />
                  <Chip
                    label={`${template.fields} fields`}
                    size="small"
                    variant="outlined"
                  />
                </Box>

                <Typography variant="caption" color="text.secondary" display="block">
                  Used {template.usageCount} times
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Created: {new Date(template.createdAt).toLocaleDateString()}
                </Typography>
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </Button>
                <Button
                  size="small"
                  startIcon={<ViewIcon />}
                >
                  Preview
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Template Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Template
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <CopyIcon sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ViewIcon sx={{ mr: 1 }} />
          Preview
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Template Name"
            fullWidth
            variant="outlined"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newTemplate.description}
            onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={newTemplate.category}
              label="Category"
              onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
            >
              {categories.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {category.icon}
                    {category.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTemplate}
            disabled={!newTemplate.name.trim()}
          >
            Create Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for Mobile */}
      <Fab
        color="primary"
        aria-label="add template"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', sm: 'none' },
        }}
        onClick={() => setCreateDialogOpen(true)}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Templates;
