const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const catalogRoutes = require('./routes/catalog.routes');

const app = express();
const PORT = process.env.PORT || 4005;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'catalog-service',
    timestamp: new Date().toISOString(),
  });
});

// Catalog routes
app.use('/', catalogRoutes);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Boot server and run DB initialization
async function start() {
  try {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 catalog-service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start catalog-service:', err);
    process.exit(1);
  }
}

start();
