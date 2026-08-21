const express = require('express');
const cors = require('cors');
const toolRoutes = require('./routes/tool.routes');

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

// Tool invocation routes
app.use('/', toolRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧠 agent-service running on port ${PORT}`);
});
