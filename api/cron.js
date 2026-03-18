const { fetchAllSources } = require('../server/scraper');

module.exports = async (req, res) => {
  // Allow Vercel cron (Authorization: Bearer <CRON_SECRET>) or x-cron-secret header
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers['authorization'];
    const legacyHeader = req.headers['x-cron-secret'];
    if (authHeader !== `Bearer ${secret}` && legacyHeader !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const results = await fetchAllSources();
    res.json({ ok: true, results });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
};
