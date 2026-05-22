import React, { useState } from 'react';
import {
  Box, Stepper, Step, StepLabel, Paper, Typography, Button, TextField,
  IconButton, MenuItem, Select, InputLabel, FormControl, Alert, Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const STEPS = ['Upload Document', 'Add Recipients & Roles', 'Place Signature Fields', 'Review & Send'];
const ROLES = ['Signer', 'Sender', 'Witness', 'Approver', 'CC'];
const FIELD_TYPES = ['signature', 'initial', 'date', 'text'];

const SendEnvelopeWizard = () => {
  const [active, setActive] = useState(0);
  const [docName, setDocName] = useState('msa-acme.pdf');
  const [docPages, setDocPages] = useState(3);
  const [recipients, setRecipients] = useState([
    { name: 'Charlie Brown', email: 'charlie.brown@client.com', role: 'Signer' },
  ]);
  const [fields, setFields] = useState([{ type: 'signature', page: 1, x: 120, y: 480 }]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const addRecipient = () => setRecipients([...recipients, { name: '', email: '', role: 'Signer' }]);
  const updateRecipient = (i, key, val) => {
    const next = recipients.slice();
    next[i] = { ...next[i], [key]: val };
    setRecipients(next);
  };
  const removeRecipient = (i) => setRecipients(recipients.filter((_, idx) => idx !== i));

  const addField = () => setFields([...fields, { type: 'signature', page: 1, x: 100, y: 100 }]);
  const updateField = (i, key, val) => {
    const next = fields.slice();
    next[i] = { ...next[i], [key]: val };
    setFields(next);
  };
  const removeField = (i) => setFields(fields.filter((_, idx) => idx !== i));

  const next = () => setActive((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setActive((s) => Math.max(0, s - 1));

  const submit = async () => {
    setSending(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/custom-views/send-envelope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: { name: docName, pages: Number(docPages) || 1, sizeBytes: 128000 },
          recipients,
          fields,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'send failed');
      setResult(data);
    } catch (e) { setError(String(e.message || e)); }
    finally { setSending(false); }
  };

  return (
    <Paper sx={{ p: 2 }} data-testid="send-envelope-wizard">
      <Typography variant="h6" sx={{ mb: 2 }}>Send Envelope Wizard</Typography>
      <Stepper activeStep={active} sx={{ mb: 3 }}>
        {STEPS.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
      </Stepper>

      {active === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
          <TextField label="Document file name" value={docName} onChange={(e) => setDocName(e.target.value)} />
          <TextField label="Pages" type="number" value={docPages} onChange={(e) => setDocPages(e.target.value)} />
          <Typography variant="caption" color="text.secondary">
            Drag a PDF here (simulated). Filename is sent to backend as document metadata.
          </Typography>
        </Box>
      )}

      {active === 1 && (
        <Box>
          {recipients.map((r, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <TextField size="small" label="Name" value={r.name} onChange={(e) => updateRecipient(i, 'name', e.target.value)} />
              <TextField size="small" label="Email" value={r.email} onChange={(e) => updateRecipient(i, 'email', e.target.value)} />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Role</InputLabel>
                <Select label="Role" value={r.role} onChange={(e) => updateRecipient(i, 'role', e.target.value)}>
                  {ROLES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                </Select>
              </FormControl>
              <IconButton onClick={() => removeRecipient(i)} aria-label="remove"><DeleteIcon /></IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={addRecipient}>Add recipient</Button>
        </Box>
      )}

      {active === 2 && (
        <Box>
          {fields.map((f, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={f.type} onChange={(e) => updateField(i, 'type', e.target.value)}>
                  {FIELD_TYPES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Page" type="number" value={f.page} onChange={(e) => updateField(i, 'page', Number(e.target.value))} />
              <TextField size="small" label="X" type="number" value={f.x} onChange={(e) => updateField(i, 'x', Number(e.target.value))} />
              <TextField size="small" label="Y" type="number" value={f.y} onChange={(e) => updateField(i, 'y', Number(e.target.value))} />
              <IconButton onClick={() => removeField(i)} aria-label="remove"><DeleteIcon /></IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={addField}>Add field</Button>
        </Box>
      )}

      {active === 3 && (
        <Box>
          <Typography variant="subtitle1">Document</Typography>
          <Chip label={`${docName} • ${docPages} pages`} sx={{ mb: 1 }} />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>Recipients ({recipients.length})</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {recipients.map((r, i) => <Chip key={i} label={`${r.name || '?'} <${r.email || '?'}> – ${r.role}`} />)}
          </Box>
          <Typography variant="subtitle1">Fields ({fields.length})</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {fields.map((f, i) => <Chip key={i} label={`${f.type} p${f.page} (${f.x},${f.y})`} />)}
          </Box>
          <Button variant="contained" disabled={sending} onClick={submit}>
            {sending ? 'Sending…' : 'Send Envelope'}
          </Button>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {result && (
            <Alert severity="success" sx={{ mt: 2 }} data-testid="wizard-result">
              Envelope <b>{result.envelopeId}</b> sent at {result.createdAt}. Status: {result.status}.
            </Alert>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button disabled={active === 0} onClick={back}>Back</Button>
        {active < STEPS.length - 1 ? (
          <Button variant="contained" onClick={next}>Next</Button>
        ) : null}
      </Box>
    </Paper>
  );
};

export default SendEnvelopeWizard;
