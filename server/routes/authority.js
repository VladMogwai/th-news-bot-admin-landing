const express = require('express');
const router  = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/authority — list all
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.sourceAuthority.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/authority/export — SOURCE_AUTHORITY object for pipeline
router.get('/export', async (req, res) => {
  try {
    const rows = await prisma.sourceAuthority.findMany();
    const defaultRow = rows.find(r => r.channelUsername === '__default__');
    const defaultVal = defaultRow ? defaultRow.authority : 0.5;

    const obj = { default: defaultVal };
    for (const r of rows) {
      if (r.channelUsername !== '__default__') obj[r.channelUsername] = r.authority;
    }
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/authority — add entry
router.post('/', async (req, res) => {
  const { channelUsername, authority, label } = req.body;
  if (!channelUsername || !channelUsername.startsWith('@'))
    return res.status(400).json({ error: 'channelUsername must start with @' });
  if (authority === undefined || authority < 0 || authority > 1)
    return res.status(400).json({ error: 'authority must be 0.0–1.0' });

  try {
    const row = await prisma.sourceAuthority.create({
      data: { channelUsername, authority: parseFloat(authority), label: label || null },
    });
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/authority/:id — update authority / label
router.patch('/:id', async (req, res) => {
  const { authority, label } = req.body;
  if (authority !== undefined && (authority < 0 || authority > 1))
    return res.status(400).json({ error: 'authority must be 0.0–1.0' });

  try {
    const row = await prisma.sourceAuthority.update({
      where: { id: req.params.id },
      data: {
        ...(authority !== undefined ? { authority: parseFloat(authority) } : {}),
        ...(label    !== undefined ? { label }                            : {}),
      },
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/authority/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.sourceAuthority.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
