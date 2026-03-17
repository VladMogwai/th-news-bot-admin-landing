const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { fetchSource, fetchAllSources } = require('../scraper');
const axios = require('axios');
const FormData = require('form-data');

const prisma = new PrismaClient();

// ── Telegram helpers ─────────────────────────────────────────────────────────

async function downloadBuffer(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://t.me/' },
      timeout: 10000,
      signal: controller.signal,
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error('Failed to download image:', url, e.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendToTelegram(post) {
  const settings = await prisma.botSettings.findMany();
  const cfg = Object.fromEntries(settings.map(r => [r.key, r.value]));
  const token = cfg.bot_token;
  const chatId = cfg.target_channel_id;
  if (!token || !chatId) throw new Error('bot_token or target_channel_id not configured');

  const mediaUrls = (Array.isArray(post.mediaUrls)
    ? post.mediaUrls
    : (typeof post.mediaUrls === 'string' ? JSON.parse(post.mediaUrls) : [])
  ).filter(Boolean).slice(0, 10);

  const base = `https://api.telegram.org/bot${token}`;
  const caption = (post.content || '').slice(0, 1024);
  const fullText = (post.content || '').slice(0, 4096);

  // Text-only post
  if (mediaUrls.length === 0) {
    const res = await axios.post(`${base}/sendMessage`, { chat_id: chatId, text: fullText });
    if (!res.data.ok) throw new Error(`sendMessage failed: ${res.data.description}`);
    return;
  }

  // Single image
  if (mediaUrls.length === 1) {
    const buf = await downloadBuffer(mediaUrls[0]);
    if (!buf) {
      // fallback: send without image
      const res = await axios.post(`${base}/sendMessage`, { chat_id: chatId, text: fullText });
      if (!res.data.ok) throw new Error(`sendMessage failed: ${res.data.description}`);
      return;
    }
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('photo', buf, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    const res = await axios.post(`${base}/sendPhoto`, form, { headers: form.getHeaders() });
    if (!res.data.ok) throw new Error(`sendPhoto failed: ${res.data.description}`);
    return;
  }

  // Multiple images — sendMediaGroup
  const media = [];
  for (const url of mediaUrls) {
    const buf = await downloadBuffer(url);
    if (!buf) continue;
    media.push({ buf, caption: media.length === 0 ? caption : undefined });
  }

  if (media.length === 0) {
    const res = await axios.post(`${base}/sendMessage`, { chat_id: chatId, text: fullText });
    if (!res.data.ok) throw new Error(`sendMessage failed: ${res.data.description}`);
    return;
  }

  const form = new FormData();
  form.append('chat_id', chatId);
  const mediaJson = media.map((m, i) => ({
    type: 'photo',
    media: `attach://photo_${i}`,
    ...(m.caption ? { caption: m.caption } : {}),
  }));
  form.append('media', JSON.stringify(mediaJson));
  media.forEach((m, i) => {
    form.append(`photo_${i}`, m.buf, { filename: `photo_${i}.jpg`, contentType: 'image/jpeg' });
  });
  const res = await axios.post(`${base}/sendMediaGroup`, form, { headers: form.getHeaders() });
  if (!res.data.ok) throw new Error(`sendMediaGroup failed: ${res.data.description}`);
}

// ── Bulk actions ─────────────────────────────────────────────────────────────

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
        try {
          await sendToTelegram(post);
          await prisma.post.update({
            where: { id: post.id },
            data: { isSent: true, sentAt: new Date() },
          });
        } catch (e) {
          console.error(`Failed to send post ${post.id}:`, e.message);
        }
      }
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Sources CRUD ─────────────────────────────────────────────────────────────

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

// ── Per-source actions ────────────────────────────────────────────────────────

router.post('/:id/fetch', async (req, res) => {
  try {
    const source = await prisma.source.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const added = await fetchSource(source);
    res.json({ ok: true, added });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

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

    // Mark as sent ONLY after successful Telegram response
    const updated = await prisma.post.update({
      where: { id: req.params.postId },
      data: { isSent: true, sentAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    console.error(`Send post ${req.params.postId} failed:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sources/:id/posts/:postId
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
