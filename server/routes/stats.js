const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [scrapedToday, sentToday, recentLogs] = await Promise.all([
      prisma.post.count({ where: { scrapedAt: { gte: todayStart } } }),
      prisma.post.count({ where: { isSent: true, sentAt: { gte: todayStart } } }),
      prisma.scrapeLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { source: { select: { name: true, url: true } } },
      }),
    ]);

    res.json({ scrapedToday, sentToday, recentLogs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
