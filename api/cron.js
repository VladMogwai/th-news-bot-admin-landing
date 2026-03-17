const { fetchAllSources } = require('../server/scraper');

module.exports = async (req, res) => {
  // Allow Vercel cron (no auth header) or secret key
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await fetchAllSources();
    res.json({ ok: true, results });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
};
