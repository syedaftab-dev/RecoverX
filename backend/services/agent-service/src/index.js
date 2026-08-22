const express = require('express');
const cors = require('cors');
const chatRoutes = require('./routes/chat.routes');
const toolRoutes = require('./routes/tool.routes');
const recoveryRoutes = require('./routes/recovery.routes');

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'agent-service',
    timestamp: new Date().toISOString(),
  });
});

// Mount chat, tool, and recovery routes
app.use('/', chatRoutes);
app.use('/', toolRoutes);
app.use('/', recoveryRoutes);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧠 agent-service running on port ${PORT}`);
});
