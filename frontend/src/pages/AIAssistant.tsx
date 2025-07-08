import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Divider,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Description as DocumentIcon,
  Analytics as AnalyzeIcon,
  AutoFixHigh as GenerateIcon,
  FindInPage as DetectIcon,
  Send as SendIcon,
  History as HistoryIcon,
  Lightbulb as SuggestionIcon,
  Warning as RiskIcon,
  CheckCircle as ComplianceIcon,
} from '@mui/icons-material';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface AnalysisResult {
  summary: string;
  risks: string[];
  compliance: string[];
  suggestions: string[];
}

const AIAssistant: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Hello! I\'m your AI assistant. I can help you analyze documents, generate contracts, detect signature fields, and answer questions about legal documents. How can I assist you today?',
      timestamp: new Date(),
    },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contractType, setContractType] = useState('service-agreement');
  const [contractPrompt, setContractPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const contractTypes = [
    { value: 'service-agreement', label: 'Service Agreement' },
    { value: 'nda', label: 'Non-Disclosure Agreement' },
    { value: 'employment', label: 'Employment Contract' },
    { value: 'vendor', label: 'Vendor Agreement' },
    { value: 'lease', label: 'Lease Agreement' },
    { value: 'partnership', label: 'Partnership Agreement' },
  ];

  const quickActions = [
    {
      title: 'Analyze Document',
      description: 'Get AI-powered analysis of your documents',
      icon: <AnalyzeIcon />,
      action: () => handleDocumentAnalysis(),
    },
    {
      title: 'Generate Contract',
      description: 'Create contracts using AI assistance',
      icon: <GenerateIcon />,
      action: () => setActiveTab(1),
    },
    {
      title: 'Detect Fields',
      description: 'Automatically detect signature fields',
      icon: <DetectIcon />,
      action: () => handleFieldDetection(),
    },
  ];

  const recentAnalyses = [
    {
      document: 'Service Agreement v2.pdf',
      type: 'Risk Analysis',
      result: 'Medium Risk - Missing termination clause',
      timestamp: '2 hours ago',
    },
    {
      document: 'NDA Template.docx',
      type: 'Compliance Check',
      result: 'Compliant - GDPR requirements met',
      timestamp: '1 day ago',
    },
    {
      document: 'Employment Contract.pdf',
      type: 'Field Detection',
      result: '12 signature fields detected',
      timestamp: '2 days ago',
    },
  ];

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: newMessage,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: generateAIResponse(newMessage),
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const generateAIResponse = (userInput: string): string => {
    const responses = [
      "I can help you with that! For document analysis, I recommend uploading your document first and I'll provide a comprehensive review including risk assessment and compliance checks.",
      "That's a great question about contract law. Based on current regulations, I suggest including specific clauses that address data protection and liability limitations.",
      "For signature field detection, I can automatically identify areas in your document where signatures, initials, or dates are needed. This saves significant time in document preparation.",
      "Contract generation works best when you provide specific details about the agreement type, parties involved, and key terms. I can create a professional template based on your requirements.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleDocumentAnalysis = () => {
    setIsLoading(true);
    // Simulate analysis
    setTimeout(() => {
      setAnalysisResult({
        summary: 'This service agreement contains standard terms with some areas for improvement. The document structure is professional and covers most essential elements.',
        risks: [
          'Missing force majeure clause',
          'Termination notice period could be more specific',
          'Liability limitations need strengthening',
        ],
        compliance: [
          'GDPR compliant data processing terms',
          'Standard industry payment terms',
          'Proper intellectual property clauses',
        ],
        suggestions: [
          'Add dispute resolution mechanism',
          'Include service level agreements',
          'Specify governing law jurisdiction',
        ],
      });
      setIsLoading(false);
    }, 2000);
  };

  const handleContractGeneration = () => {
    if (!contractPrompt.trim()) return;
    
    setIsLoading(true);
    // Simulate contract generation
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: `I've generated a ${contractTypes.find(t => t.value === contractType)?.label} based on your requirements: "${contractPrompt}". The contract includes standard clauses, payment terms, and signature fields. Would you like me to create a document from this template?`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMessage]);
      setContractPrompt('');
      setIsLoading(false);
      setActiveTab(0); // Switch back to chat
    }, 2000);
  };

  const handleFieldDetection = () => {
    setIsLoading(true);
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: 'I\'ve analyzed your document and detected 8 signature fields, 3 initial fields, and 5 date fields. I can automatically place these fields in the optimal positions for signing. Would you like me to proceed?',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AIIcon color="primary" />
        AI Assistant
      </Typography>

      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                {quickActions.map((action, index) => (
                  <Grid item xs={12} key={index}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={action.icon}
                      onClick={action.action}
                      sx={{ justifyContent: 'flex-start', p: 2 }}
                    >
                      <Box sx={{ textAlign: 'left', ml: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {action.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {action.description}
                        </Typography>
                      </Box>
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Recent Analyses */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon />
                Recent Analyses
              </Typography>
              <List dense>
                {recentAnalyses.map((analysis, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <DocumentIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={analysis.document}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {analysis.type}: {analysis.result}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {analysis.timestamp}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab label="AI Chat" />
              <Tab label="Generate Contract" />
              <Tab label="Document Analysis" />
            </Tabs>

            {/* Chat Tab */}
            {activeTab === 0 && (
              <>
                <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
                  {chatMessages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                        mb: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1,
                          maxWidth: '80%',
                          flexDirection: message.type === 'user' ? 'row-reverse' : 'row',
                        }}
                      >
                        <Avatar
                          sx={{
                            bgcolor: message.type === 'user' ? 'primary.main' : 'secondary.main',
                            width: 32,
                            height: 32,
                          }}
                        >
                          {message.type === 'user' ? 'U' : <AIIcon />}
                        </Avatar>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: message.type === 'user' ? 'primary.light' : 'grey.100',
                            color: message.type === 'user' ? 'white' : 'text.primary',
                          }}
                        >
                          <Typography variant="body2">{message.content}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                            {message.timestamp.toLocaleTimeString()}
                          </Typography>
                        </Paper>
                      </Box>
                    </Box>
                  ))}
                  {isLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                        <AIIcon />
                      </Avatar>
                      <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" sx={{ ml: 1, display: 'inline' }}>
                          AI is thinking...
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                </CardContent>
                <Divider />
                <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    placeholder="Ask me anything about documents, contracts, or legal analysis..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isLoading}
                  />
                  <Button
                    variant="contained"
                    endIcon={<SendIcon />}
                    onClick={handleSendMessage}
                    disabled={isLoading || !newMessage.trim()}
                  >
                    Send
                  </Button>
                </Box>
              </>
            )}

            {/* Generate Contract Tab */}
            {activeTab === 1 && (
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AI Contract Generation
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Contract Type</InputLabel>
                      <Select
                        value={contractType}
                        label="Contract Type"
                        onChange={(e) => setContractType(e.target.value)}
                      >
                        {contractTypes.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      label="Describe your contract requirements"
                      placeholder="E.g., Service agreement for web development services, 6-month duration, monthly payments of $5000, includes IP transfer..."
                      value={contractPrompt}
                      onChange={(e) => setContractPrompt(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<GenerateIcon />}
                      onClick={handleContractGeneration}
                      disabled={isLoading || !contractPrompt.trim()}
                    >
                      {isLoading ? 'Generating...' : 'Generate Contract'}
                    </Button>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Tips for better results:</strong>
                      </Typography>
                      <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
                        <li>Include specific terms and conditions</li>
                        <li>Mention payment schedules and amounts</li>
                        <li>Specify duration and termination clauses</li>
                        <li>Include any special requirements</li>
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            )}

            {/* Document Analysis Tab */}
            {activeTab === 2 && (
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Document Analysis Results
                </Typography>
                {analysisResult ? (
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Alert severity="info">
                        <Typography variant="body2">
                          <strong>Summary:</strong> {analysisResult.summary}
                        </Typography>
                      </Alert>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" color="error" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <RiskIcon />
                            Risks Identified
                          </Typography>
                          <List dense>
                            {analysisResult.risks.map((risk, index) => (
                              <ListItem key={index}>
                                <ListItemText primary={risk} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" color="success.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ComplianceIcon />
                            Compliance
                          </Typography>
                          <List dense>
                            {analysisResult.compliance.map((item, index) => (
                              <ListItem key={index}>
                                <ListItemText primary={item} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SuggestionIcon />
                            Suggestions
                          </Typography>
                          <List dense>
                            {analysisResult.suggestions.map((suggestion, index) => (
                              <ListItem key={index}>
                                <ListItemText primary={suggestion} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                      No analysis results yet. Upload a document and click "Analyze Document" to get started.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AnalyzeIcon />}
                      onClick={handleDocumentAnalysis}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Analyzing...' : 'Analyze Sample Document'}
                    </Button>
                  </Box>
                )}
              </CardContent>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AIAssistant;
