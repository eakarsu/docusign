import React, { useState } from 'react';
import {
  Box, Paper, Typography, TextField, MenuItem, Button, Alert, Chip, Stack
} from '@mui/material';

const ENVELOPES = [
  { id: 'ENV-2026-0001', title: 'Master Services Agreement – Acme Corp' },
  { id: 'ENV-2026-0002', title: 'NDA – TechCorp' },
  { id: 'ENV-2026-0003', title: 'Employment Contract – Software Engineer' },
];

const CertOfCompletionPDF = () => {
  const [envelopeId, setEnvelopeId] = useState(ENVELOPES[0].id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastUrl, setLastUrl] = useState('');

  const generate = async () => {
    setGenerating(true); setError(''); setLastUrl('');
    try {
      const meta = ENVELOPES.find((e) => e.id === envelopeId);
      const res = await fetch('/api/custom-views/cert-of-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envelopeId, title: meta?.title }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setLastUrl(url);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cert-${envelopeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Paper sx={{ p: 2 }} data-testid="cert-of-completion">
      <Typography variant="h6" sx={{ mb: 2 }}>Certificate of Completion (PDF)</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <TextField
          select
          label="Envelope"
          value={envelopeId}
          onChange={(e) => setEnvelopeId(e.target.value)}
          sx={{ minWidth: 320 }}
        >
          {ENVELOPES.map((e) => (
            <MenuItem key={e.id} value={e.id}>{e.id} — {e.title}</MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={generate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate PDF'}
        </Button>
      </Stack>
      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label="includes envelope ID" />
        <Chip label="recipients + timestamps" />
        <Chip label="SHA-256 hash" />
      </Box>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {lastUrl && (
        <Alert severity="success" sx={{ mt: 2 }} data-testid="cert-success">
          PDF downloaded. <a href={lastUrl} target="_blank" rel="noreferrer">Open again</a>
        </Alert>
      )}
    </Paper>
  );
};

export default CertOfCompletionPDF;
