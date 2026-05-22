import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Chip } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from 'recharts';

const COLOR = {
  created: '#1976d2',
  sent: '#0288d1',
  viewed: '#8e24aa',
  signed: '#2e7d32',
  reminder: '#f9a825',
};

const AuditTrail = ({ envelopeId = 'ENV-2026-0001' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/custom-views/audit-trail?envelopeId=${encodeURIComponent(envelopeId)}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [envelopeId]);

  if (loading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const chartData = (data.timeline || []).map((e) => ({
    label: `${e.order}. ${e.actor}`,
    offsetHours: e.offsetHours + 0.5,
    action: e.action,
    timestamp: e.timestamp,
  }));

  return (
    <Paper sx={{ p: 2 }} data-testid="audit-trail">
      <Typography variant="h6" sx={{ mb: 1 }}>Document Audit Trail — {data.envelopeId}</Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={`${data.totalEvents} events`} />
        {Object.keys(COLOR).map((k) => (
          <Chip key={k} size="small" label={k} sx={{ bgcolor: COLOR[k], color: '#fff' }} />
        ))}
      </Box>
      <Box sx={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={chartData} margin={{ top: 8, right: 24, left: 80, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" label={{ value: 'Hours since first event', position: 'insideBottom', offset: -10 }} />
            <YAxis type="category" dataKey="label" width={140} />
            <Tooltip formatter={(v, n, p) => [`${p.payload.action} @ ${p.payload.timestamp}`, 'event']} />
            <Legend />
            <Bar dataKey="offsetHours" name="action time (h)">
              {chartData.map((e, i) => (
                <Cell key={i} fill={COLOR[e.action] || '#90a4ae'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default AuditTrail;
