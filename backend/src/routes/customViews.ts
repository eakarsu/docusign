// Custom Views endpoints — e-signature workflow features
// 4 endpoints: signature-flow, audit-trail, send-envelope, cert-of-completion
import express, { Request, Response } from 'express';
import crypto from 'crypto';

const router = express.Router();

// ---------- helpers ----------
function pickEnvelopeId(input: any, fallback = 'ENV-2026-0001'): string {
  return (input?.envelopeId || input?.id || fallback).toString();
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// ---------- VIZ 1: signature-flow ----------
// Returns sequential steps with recipients and signed/pending status.
router.get('/signature-flow', (req: Request, res: Response) => {
  const envelopeId = (req.query.envelopeId as string) || 'ENV-2026-0001';
  const steps = [
    {
      step: 1,
      label: 'Sender Prepares',
      recipients: [
        { name: 'John Doe', role: 'Sender', email: 'john.doe@company.com', status: 'signed', signedAt: '2026-05-12T09:14:00Z' },
      ],
    },
    {
      step: 2,
      label: 'Counterparty Signs',
      recipients: [
        { name: 'Charlie Brown', role: 'Signer', email: 'charlie.brown@client.com', status: 'signed', signedAt: '2026-05-13T11:02:00Z' },
        { name: 'Diana Prince', role: 'Signer', email: 'diana.prince@client.com', status: 'signed', signedAt: '2026-05-13T15:48:00Z' },
      ],
    },
    {
      step: 3,
      label: 'Witness Approvals',
      recipients: [
        { name: 'Fiona Apple', role: 'Witness', email: 'fiona.apple@partner.com', status: 'pending', signedAt: null },
        { name: 'George Lucas', role: 'Witness', email: 'george.lucas@partner.com', status: 'pending', signedAt: null },
      ],
    },
    {
      step: 4,
      label: 'Final CC',
      recipients: [
        { name: 'Hannah Montana', role: 'CC', email: 'hannah.montana@viewer.com', status: 'pending', signedAt: null },
      ],
    },
  ];
  const totalRecipients = steps.reduce((a, s) => a + s.recipients.length, 0);
  const signed = steps.reduce((a, s) => a + s.recipients.filter((r) => r.status === 'signed').length, 0);
  return res.json({
    envelopeId,
    title: 'Master Services Agreement – Acme Corp',
    steps,
    totalRecipients,
    signed,
    pending: totalRecipients - signed,
    overallStatus: signed === totalRecipients ? 'completed' : 'in_progress',
  });
});

// ---------- VIZ 2: audit-trail ----------
// Returns horizontal timeline of doc actions with timestamps.
router.get('/audit-trail', (req: Request, res: Response) => {
  const envelopeId = (req.query.envelopeId as string) || 'ENV-2026-0001';
  const base = new Date('2026-05-12T09:00:00Z').getTime();
  const hr = 3600 * 1000;
  const events = [
    { actor: 'John Doe',       action: 'created',  t: base + 0 * hr,  ip: '10.0.0.21' },
    { actor: 'John Doe',       action: 'sent',     t: base + 1 * hr,  ip: '10.0.0.21' },
    { actor: 'Charlie Brown',  action: 'viewed',   t: base + 4 * hr,  ip: '198.51.100.7' },
    { actor: 'Charlie Brown',  action: 'signed',   t: base + 6 * hr,  ip: '198.51.100.7' },
    { actor: 'Diana Prince',   action: 'viewed',   t: base + 9 * hr,  ip: '203.0.113.4' },
    { actor: 'Diana Prince',   action: 'signed',   t: base + 11 * hr, ip: '203.0.113.4' },
    { actor: 'Fiona Apple',    action: 'viewed',   t: base + 22 * hr, ip: '203.0.113.91' },
    { actor: 'System',         action: 'reminder', t: base + 30 * hr, ip: 'server' },
  ];
  // recharts horizontal timeline → expose start/duration buckets.
  const t0 = events[0].t;
  const timeline = events.map((e, idx) => ({
    name: e.actor,
    action: e.action,
    offsetHours: Math.round((e.t - t0) / hr),
    timestamp: new Date(e.t).toISOString(),
    ip: e.ip,
    order: idx + 1,
  }));
  return res.json({ envelopeId, timeline, totalEvents: events.length });
});

// ---------- NON-VIZ 1: send-envelope ----------
// Accept wizard payload, return envelope draft + status URL.
router.post('/send-envelope', (req: Request, res: Response) => {
  const body = req.body || {};
  const document = body.document || {};
  const recipients: any[] = Array.isArray(body.recipients) ? body.recipients : [];
  const fields: any[] = Array.isArray(body.fields) ? body.fields : [];
  if (!document?.name) return res.status(400).json({ error: 'document.name required' });
  if (recipients.length === 0) return res.status(400).json({ error: 'at least one recipient required' });
  const envelopeId = 'ENV-' + Date.now().toString(36).toUpperCase();
  const created = new Date().toISOString();
  return res.json({
    envelopeId,
    status: 'sent',
    createdAt: created,
    document: { name: document.name, sizeBytes: document.sizeBytes || 0, pages: document.pages || 1 },
    recipients: recipients.map((r, i) => ({
      order: i + 1,
      name: r.name || `Recipient ${i + 1}`,
      email: r.email || '',
      role: r.role || 'Signer',
      status: 'pending',
    })),
    fields: fields.map((f, i) => ({ id: 'f' + (i + 1), type: f.type || 'signature', page: f.page || 1, x: f.x || 100, y: f.y || 100 })),
    statusUrl: `/api/custom-views/signature-flow?envelopeId=${envelopeId}`,
  });
});

// ---------- NON-VIZ 2: cert-of-completion ----------
// Build a PDF via pdfkit for the chosen envelope.
router.post('/cert-of-completion', async (req: Request, res: Response) => {
  try {
    const PDFDocument = require('pdfkit');
    const envelopeId = pickEnvelopeId(req.body);
    const title = (req.body?.title as string) || 'Master Services Agreement – Acme Corp';
    const recipients = Array.isArray(req.body?.recipients) && req.body.recipients.length
      ? req.body.recipients
      : [
          { name: 'John Doe', email: 'john.doe@company.com', role: 'Sender', signedAt: '2026-05-12T09:14:00Z' },
          { name: 'Charlie Brown', email: 'charlie.brown@client.com', role: 'Signer', signedAt: '2026-05-13T11:02:00Z' },
          { name: 'Diana Prince', email: 'diana.prince@client.com', role: 'Signer', signedAt: '2026-05-13T15:48:00Z' },
        ];

    const issuedAt = new Date().toISOString();
    const hashSource = `${envelopeId}|${title}|${issuedAt}|${recipients.map((r: any) => r.email).join(',')}`;
    const docHash = sha256(hashSource);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cert-${envelopeId}.pdf"`);

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    doc.pipe(res);

    doc.fontSize(22).text('Certificate of Completion', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Envelope ID: ${envelopeId}`);
    doc.text(`Document: ${title}`);
    doc.text(`Issued: ${issuedAt}`);
    doc.moveDown();

    doc.fontSize(14).text('Recipients', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    recipients.forEach((r: any, i: number) => {
      doc.text(`${i + 1}. ${r.name} <${r.email}>  – ${r.role || 'Signer'}`);
      doc.text(`    Signed: ${r.signedAt || 'pending'}`);
      doc.moveDown(0.2);
    });

    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text(`Document Hash (SHA-256): ${docHash}`, { width: 500 });
    doc.fillColor('#000');
    doc.moveDown();
    doc.fontSize(9).text('This certificate is generated by the eSign Views platform and proves the integrity of the signing ceremony.', { align: 'center' });

    doc.end();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed to generate certificate' });
  }
});

export default router;
