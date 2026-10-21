const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDB } = require('./config/db');
const { seedInitialDataIfEmpty } = require('./utils/seedDefaults');
const errorHandler = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const evidenceRoutes = require('./routes/evidenceRoutes');
const custodyRoutes = require('./routes/custodyRoutes');
const auditRoutes = require('./routes/auditRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const courtRoutes = require('./routes/courtRoutes');

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets directly (Single-server convenience for college demo)
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// Mount REST API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/custody', custodyRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/court', courtRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'P.R.A.M.A.N backend services operational',
    timestamp: new Date().toISOString(),
  });
});

// Handle undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// HTML Single Page Fallback for client navigation if accessing direct roots
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Centralized error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server after connecting to database
const startServer = async () => {
  try {
    await connectDB();
    await seedInitialDataIfEmpty();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  P.R.A.M.A.N Digital Evidence Management System       `);
      console.log(`  Server running on http://localhost:${PORT}             `);
      console.log(`  Frontend served at: http://localhost:${PORT}/        `);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to initialize PRAMAN server:', err.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
