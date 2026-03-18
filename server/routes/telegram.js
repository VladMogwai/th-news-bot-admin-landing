const express = require('express');
const router = express.Router();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { PrismaClient } = require('@prisma/client');
const { resetClient } = require('../telegramClient');

const prisma = new PrismaClient();

// Temporary in-memory auth state: phone -> { client, phoneCodeHash }
const authState = new Map();

async function getApiCredentials() {
  const rows = await prisma.botSettings.findMany();
  const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { apiId: parseInt(cfg.tg_api_id), apiHash: cfg.tg_api_hash || '' };
}

// GET /api/telegram/status
router.get('/status', async (req, res) => {
  try {
    const rows = await prisma.botSettings.findMany();
    const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ connected: !!cfg.tg_session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/auth/start
router.post('/auth/start', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    const { apiId, apiHash } = await getApiCredentials();
    if (!apiId || !apiHash)
      return res.status(400).json({ error: 'Set tg_api_id and tg_api_hash in Settings first' });

    const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
      connectionRetries: 3,
    });
    await client.connect();

    const { phoneCodeHash } = await client.sendCode({ apiId, apiHash }, phone);
    authState.set(phone, { client, phoneCodeHash });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/auth/confirm
router.post('/auth/confirm', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });

  const state = authState.get(phone);
  if (!state)
    return res.status(400).json({ error: 'No pending auth for this phone. Start auth first.' });

  try {
    const { client, phoneCodeHash } = state;
    await client.signIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code });

    const sessionStr = client.session.save();
    await prisma.botSettings.upsert({
      where: { key: 'tg_session' },
      update: { value: sessionStr },
      create: { key: 'tg_session', value: sessionStr },
    });

    authState.delete(phone);
    resetClient();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/auth/logout
router.post('/auth/logout', async (req, res) => {
  try {
    await prisma.botSettings.deleteMany({ where: { key: 'tg_session' } });
    resetClient();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
