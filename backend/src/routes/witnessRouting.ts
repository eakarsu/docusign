import { Router } from 'express';

const router = Router();

const envelopes = [
  { id: 'ENV-901', document: 'Real estate disclosure', signer: 'A. Gomez', witnessType: 'in-person witness', status: 'witness unassigned', dueHours: 20 },
  { id: 'ENV-902', document: 'Affidavit package', signer: 'M. Patel', witnessType: 'remote notary witness', status: 'scheduled', dueHours: 44 },
  { id: 'ENV-903', document: 'Board consent', signer: 'L. Nguyen', witnessType: 'corporate secretary', status: 'complete', dueHours: 0 },
];

router.get('/', (_req, res) => {
  res.json({
    summary: {
      envelopes: envelopes.length,
      unassigned: envelopes.filter((item) => item.status === 'witness unassigned').length,
      dueSoon: envelopes.filter((item) => item.dueHours > 0 && item.dueHours <= 24).length,
    },
    envelopes,
  });
});

router.post('/assign', (req, res) => {
  const item = envelopes.find((entry) => entry.id === req.body?.id) || envelopes[0];
  res.json({
    envelopeId: item.id,
    assignment: item.status === 'complete' ? 'no action needed' : `Assign ${item.witnessType} and resend witness instructions.`,
    auditSteps: ['record witness identity', 'capture timestamp', 'verify signer sequence'],
  });
});

export default router;
