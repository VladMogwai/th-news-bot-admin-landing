require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const sourcesRoutes = require('./routes/sources');
const settingsRoutes = require('./routes/settings');
const telegramRoutes = require('./routes/telegram');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth (public)
app.use('/api/auth', authRoutes);

// Protected
app.use('/api/stats', authenticate, statsRoutes);
app.use('/api/sources', authenticate, sourcesRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/telegram', authenticate, telegramRoutes);

// Serve React build in production (non-Vercel)
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}
