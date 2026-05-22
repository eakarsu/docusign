import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Chip, CircularProgress, Alert } from '@mui/material';

const STEP_W = 200;
const STEP_H = 110;
const GAP_X = 60;

const SignatureFlow = ({ envelopeId = 'ENV-2026-0001' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/custom-views/signature-flow?envelopeId=${encodeURIComponent(envelopeId)}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [envelopeId]);

  if (loading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const steps = data.steps || [];
  const svgWidth = steps.length * STEP_W + (steps.length - 1) * GAP_X + 40;
  const svgHeight = STEP_H + 120;

  return (
    <Paper sx={{ p: 2 }} data-testid="signature-flow">
      <Typography variant="h6" sx={{ mb: 1 }}>Signature Flow — {data.title}</Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={`Envelope ${data.envelopeId}`} />
        <Chip color="success" label={`Signed ${data.signed}`} />
        <Chip color="warning" label={`Pending ${data.pending}`} />
        <Chip color="info" label={`Status: ${data.overallStatus}`} />
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <svg width={svgWidth} height={svgHeight} role="img" aria-label="signature flow">
          {steps.map((s, idx) => {
            const x = 20 + idx * (STEP_W + GAP_X);
            const y = 20;
            const allSigned = s.recipients.every((r) => r.status === 'signed');
            const boxFill = allSigned ? '#e8f5e9' : '#fff8e1';
            const boxStroke = allSigned ? '#388e3c' : '#f57c00';
            return (
              <g key={s.step}>
                <rect x={x} y={y} width={STEP_W} height={STEP_H} rx={10} fill={boxFill} stroke={boxStroke} strokeWidth={2} />
                <text x={x + STEP_W / 2} y={y + 22} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1565c0">Step {s.step}</text>
                <text x={x + STEP_W / 2} y={y + 42} textAnchor="middle" fontSize="12" fill="#333">{s.label}</text>
                {s.recipients.slice(0, 3).map((r, ri) => (
                  <text key={ri} x={x + 12} y={y + 64 + ri * 14} fontSize="11" fill={r.status === 'signed' ? '#2e7d32' : '#ef6c00'}>
                    {r.status === 'signed' ? 'OK ' : '... '}{r.name} ({r.role})
                  </text>
                ))}
                {idx < steps.length - 1 && (
                  <g>
                    <line x1={x + STEP_W} y1={y + STEP_H / 2} x2={x + STEP_W + GAP_X} y2={y + STEP_H / 2} stroke="#666" strokeWidth={2} />
                    <polygon points={`${x + STEP_W + GAP_X},${y + STEP_H / 2} ${x + STEP_W + GAP_X - 8},${y + STEP_H / 2 - 5} ${x + STEP_W + GAP_X - 8},${y + STEP_H / 2 + 5}`} fill="#666" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </Box>
    </Paper>
  );
};

export default SignatureFlow;
