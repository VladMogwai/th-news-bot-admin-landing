const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function sendToTelegram(post) {
  const settings = await prisma.botSettings.findMany();
  const cfg = Object.fromEntries(settings.map(r => [r.key, r.value]));
  const token = cfg.bot_token;
  const chatId = cfg.target_channel_id;
  if (!token || !chatId) return;

  const imgs = Array.isArray(post.mediaUrls)
    ? post.mediaUrls
    : (typeof post.mediaUrls === 'string' ? JSON.parse(post.mediaUrls) : []);

  const base = `https://api.telegram.org/bot${token}`;

  if (imgs.length > 0) {
    await fetch(`${base}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: imgs[0], caption: post.content || '' }),
    });
  } else {
    await fetch(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: post.content || '' }),
    });
  }
}

// POST /api/sources/bulk  ← must be defined BEFORE /:id routes
router.post('/bulk', async (req, res) => {
  const { action, sourceIds } = req.body;
  if (!Array.isArray(sourceIds) || !sourceIds.length)
    return res.status(400).json({ error: 'sourceIds required' });

  try {
    if (action === 'delete') {
      for (const id of sourceIds) {
        await prisma.scrapeLog.deleteMany({ where: { sourceId: id } });
        await prisma.post.deleteMany({ where: { sourceId: id } });
        await prisma.source.delete({ where: { id } });
      }
    } else if (action === 'clear') {
      await prisma.post.updateMany({
        where: { sourceId: { in: sourceIds }, isSent: false, ignored: false },
        data: { ignored: true },
      });
    } else if (action === 'send') {
      const pending = await prisma.post.findMany({
        where: { sourceId: { in: sourceIds }, isSent: false, ignored: false },
      });
      for (const post of pending) {
        await sendToTelegram(post);
      }
      await prisma.post.updateMany({
        where: { sourceId: { in: sourceIds }, isSent: false, ignored: false },
        data: { isSent: true, sentAt: new Date() },
      });
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sources
router.get('/', async (req, res) => {
  try {
    const sources = await prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { posts: { where: { isSent: false, ignored: false } } },
        },
      },
    });
    res.json(sources);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sources
router.post('/', async (req, res) => {
  const { name, url, type } = req.body;
  if (!name || !url || !type)
    return res.status(400).json({ error: 'name, url, type are required' });

  try {
    const source = await prisma.source.create({ data: { name, url, type } });
    res.status(201).json(source);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/sources/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.scrapeLog.deleteMany({ where: { sourceId: req.params.id } });
    await prisma.post.deleteMany({ where: { sourceId: req.params.id } });
    await prisma.source.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sources/:id/fetch  (trigger signal — actual scrape is done by the bot)
router.post('/:id/fetch', async (req, res) => {
  try {
    await prisma.source.update({
      where: { id: req.params.id },
      data: { lastScrapedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sources/:id/posts
router.get('/:id/posts', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { sourceId: req.params.id, isSent: false, ignored: false },
      orderBy: { scrapedAt: 'desc' },
    });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sources/:id/posts/:postId/send
router.post('/:id/posts/:postId/send', async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await sendToTelegram(post);

    const updated = await prisma.post.update({
      where: { id: req.params.postId },
      data: { isSent: true, sentAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/sources/:id/posts/:postId  (soft-delete via ignored flag)
router.delete('/:id/posts/:postId', async (req, res) => {
  try {
    await prisma.post.update({
      where: { id: req.params.postId },
      data: { ignored: true },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
