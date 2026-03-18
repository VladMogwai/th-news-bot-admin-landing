const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
let _client = null;

async function getClient() {
  if (_client?.connected) return _client;

  const rows = await prisma.botSettings.findMany();
  const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const apiId = parseInt(cfg.tg_api_id);
  const apiHash = cfg.tg_api_hash || '';
  const sessionStr = cfg.tg_session || '';

  if (!apiId || !apiHash || !sessionStr) return null;

  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.connect();
  _client = client;
  return client;
}

function resetClient() {
  _client = null;
}

module.exports = { getClient, resetClient };
