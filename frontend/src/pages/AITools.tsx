import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import {
  Compare as CompareIcon,
  AutoAwesome as SuggestIcon,
} from '@mui/icons-material';
import { aiAPI } from '../services/api';

const AITools: React.FC = () => {
  const [tab, setTab] = useState(0);

  // compare-versions state
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [labelA, setLabelA] = useState('');
  const [labelB, setLabelB] = useState('');

  // suggest-template state
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const reset = () => {
    setError(null);
    setResult(null);
  };

  const handleCompare = async () => {
    reset();
    if (!textA.trim() || !textB.trim()) {
      setError('Both Version A text and Version B text are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await aiAPI.compareVersions(textA, textB, labelA || undefined, labelB || undefined);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggest = async () => {
    reset();
    if (!description.trim()) {
      setError('Document description is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await aiAPI.suggestTemplate(description);
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        AI Tools
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Compare document versions and suggest templates for new documents.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v);
          reset();
        }}
        sx={{ mb: 3 }}
      >
        <Tab icon={<CompareIcon />} iconPosition="start" label="Compare Versions" />
        <Tab icon={<SuggestIcon />} iconPosition="start" label="Suggest Template" />
      </Tabs>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              {tab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Label A (optional)"
                    value={labelA}
                    onChange={(e) => setLabelA(e.target.value)}
                    placeholder="e.g. Draft v1"
                    fullWidth
                    disabled={loading}
                  />
                  <TextField
                    label="Version A text"
                    value={textA}
                    onChange={(e) => setTextA(e.target.value)}
                    multiline
                    rows={6}
                    fullWidth
                    disabled={loading}
                    required
                  />
                  <TextField
                    label="Label B (optional)"
                    value={labelB}
                    onChange={(e) => setLabelB(e.target.value)}
                    placeholder="e.g. Draft v2"
                    fullWidth
                    disabled={loading}
                  />
                  <TextField
                    label="Version B text"
                    value={textB}
                    onChange={(e) => setTextB(e.target.value)}
                    multiline
                    rows={6}
                    fullWidth
                    disabled={loading}
                    required
                  />
                  <Button
                    variant="contained"
                    onClick={handleCompare}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <CompareIcon />}
                  >
                    Compare Versions
                  </Button>
                </Box>
              )}

              {tab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Document description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the document you need a template for"
                    multiline
                    rows={6}
                    fullWidth
                    disabled={loading}
                    required
                  />
                  <Button
                    variant="contained"
                    onClick={handleSuggest}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <SuggestIcon />}
                  >
                    Suggest Template
                  </Button>
                </Box>
              )}

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Result
              </Typography>
              {loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Working...</Typography>
                </Box>
              )}
              {!loading && !result && !error && (
                <Typography variant="body2" color="text.secondary">
                  Submit the form to see AI-generated output.
                </Typography>
              )}
              {!loading && result && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: 'grey.50',
                    maxHeight: 600,
                    overflow: 'auto',
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </pre>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AITools;
