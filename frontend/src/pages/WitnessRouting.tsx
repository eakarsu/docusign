import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';

const WitnessRouting: React.FC = () => {
  const [data, setData] = useState<any>({ summary: {}, envelopes: [] });
  const [assignment, setAssignment] = useState<any>(null);

  useEffect(() => {
    fetch('/api/witness-routing').then((res) => res.json()).then(setData);
  }, []);

  const assign = async (id: string) => {
    const res = await fetch('/api/witness-routing/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setAssignment(await res.json());
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Envelope Witness Routing</Typography>
      <Typography color="text.secondary" gutterBottom>Coordinate witness assignment, signer sequence, and audit evidence.</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, my: 2 }}>
        {Object.entries(data.summary).map(([key, value]) => <Card key={key}><CardContent><Typography variant="h5">{String(value)}</Typography><Typography>{key}</Typography></CardContent></Card>)}
      </Box>
      {data.envelopes.map((item: any) => (
        <Card key={item.id} sx={{ mb: 2 }}>
          <CardContent>
            <Typography fontWeight={700}>{item.id} - {item.document}</Typography>
            <Typography>{item.signer} - {item.witnessType} - {item.status}</Typography>
            <Button variant="contained" sx={{ mt: 1 }} onClick={() => assign(item.id)}>Assign witness</Button>
          </CardContent>
        </Card>
      ))}
      {assignment && <Card><CardContent><pre>{JSON.stringify(assignment, null, 2)}</pre></CardContent></Card>}
    </Box>
  );
};

export default WitnessRouting;
