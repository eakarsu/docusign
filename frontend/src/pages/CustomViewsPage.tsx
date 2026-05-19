import React from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
// JS components — allowJs is enabled in tsconfig.
// @ts-ignore
import SignatureFlow from '../components/SignatureFlow';
// @ts-ignore
import AuditTrail from '../components/AuditTrail';
// @ts-ignore
import SendEnvelopeWizard from '../components/SendEnvelopeWizard';
// @ts-ignore
import CertOfCompletionPDF from '../components/CertOfCompletionPDF';

const CustomViewsPage: React.FC = () => {
  const [tab, setTab] = React.useState(0);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>eSign Views</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Signature Flow" />
        <Tab label="Audit Trail" />
        <Tab label="Send Envelope" />
        <Tab label="Certificate PDF" />
      </Tabs>
      {tab === 0 && <SignatureFlow />}
      {tab === 1 && <AuditTrail />}
      {tab === 2 && <SendEnvelopeWizard />}
      {tab === 3 && <CertOfCompletionPDF />}
    </Box>
  );
};

export default CustomViewsPage;
