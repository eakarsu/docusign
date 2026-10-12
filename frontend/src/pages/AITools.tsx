import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import GovernedAIWorkspace from '../components/GovernedAIWorkspace';
import NativeAdvisoryReport from '../components/NativeAdvisoryReport';
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
} from '@mui/material';
import {
  Compare as CompareIcon,
  AutoAwesome as SuggestIcon,
} from '@mui/icons-material';
import { aiAPI } from '../services/api';

const templateDescriptionPresets = [
  ['Mutual NDA', 'Illustrative request for a mutual nondisclosure agreement covering confidential business discussions, permitted use, exclusions, term, return or deletion, and governing-law questions. No parties, jurisdiction, dates, or source facts are supplied; keep unresolved details as placeholders.'],
  ['Consulting services', 'Illustrative request for a consulting services agreement covering scope, deliverables, milestones, fees, expenses, confidentiality, intellectual property, termination, and dispute-resolution questions. No parties, amounts, dates, jurisdiction, or approved terms are supplied; retain placeholders and flag counsel review.'],
  ['Vendor services', 'Illustrative request for a vendor services agreement covering service levels, data handling, security obligations, subcontractors, continuity, liability, termination, and transition planning. No vendor, customer, jurisdiction, dates, or approved terms are supplied; retain placeholders and identify source checks for counsel.'],
] as const;

const AITools: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [searchParams] = useSearchParams();
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const cancel = () => { active.current?.abort(); active.current = null; setLoading(false); };


  // compare-versions state
  const [documentId, setDocumentId] = useState('');
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');

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
    if (!documentId.trim() || !fromVersion || !toVersion || Number(fromVersion) < 1 || Number(toVersion) < 1 || !Number.isInteger(Number(fromVersion)) || !Number.isInteger(Number(toVersion)) || fromVersion === toVersion) {
      setError('A document ID and two distinct integer versions are required.');
      return;
    }
    const controller = new AbortController(); active.current = controller;
    setLoading(true);
    try {
      const res = await aiAPI.compareVersions(documentId.trim(), Number(fromVersion), Number(toVersion), controller.signal);
      if (!controller.signal.aborted && active.current === controller) setResult(res.data);
    } catch (err: any) {
      if (!controller.signal.aborted && active.current === controller) setError(err.response?.data?.error || err.message || 'Request failed.');
    } finally {
      if (active.current === controller) { active.current = null; setLoading(false); }
    }
  };

  const handleSuggest = async () => {
    reset();
    if (!description.trim()) {
      setError('Document description is required.');
      return;
    }
    const controller = new AbortController(); active.current = controller;
    setLoading(true);
    try {
      const res = await aiAPI.suggestTemplate(description, controller.signal);
      if (!controller.signal.aborted && active.current === controller) setResult(res.data);
    } catch (err: any) {
      if (!controller.signal.aborted && active.current === controller) setError(err.response?.data?.error || err.message || 'Request failed.');
    } finally {
      if (active.current === controller) { active.current = null; setLoading(false); }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <GovernedAIWorkspace requestedDocumentId={searchParams.get('documentId') || ''} />
      <Typography variant="h4" gutterBottom sx={{ mt: 5 }}>
        Deterministic document tools
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Compare actual OCR versions and rank existing authoritative templates. These native tools use deterministic algorithms.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          cancel(); setTab(v);
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
                    label="Document ID"
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                    fullWidth
                    disabled={loading}
                    required
                  />
                  <TextField
                    label="From version"
                    type="number"
                    value={fromVersion}
                    onChange={(e) => setFromVersion(e.target.value)}
                    inputProps={{ min: 1, step: 1 }}
                    disabled={loading}
                    required
                  />
                  <TextField label="To version" type="number" value={toVersion} onChange={(e) => setToVersion(e.target.value)} inputProps={{ min: 1, step: 1 }} disabled={loading} required />
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
                  <Typography variant="body2" color="text.secondary">Fill the complete example brief, then review and replace illustrative details before requesting a template.</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {templateDescriptionPresets.map(([label, value]) => <Button key={label} type="button" variant="outlined" disabled={loading} onClick={() => { setDescription(value); reset(); }}>
                      Fill all fields · {label}
                    </Button>)}
                  </Box>
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

              {loading && <Button sx={{ mt: 2 }} onClick={cancel}>Cancel</Button>}
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
                  Submit actual source inputs to see the comparison or template ranking.
                </Typography>
              )}
              {!loading && result && <div className="na-workspace"><NativeAdvisoryReport response={result} result={result} model={undefined} tokens={undefined} loading={false} error={undefined} title={tab === 0 ? 'Document version comparison' : 'Authoritative template ranking'} label="Deterministic result" /></div>}

            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AITools;
