const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadSourceAuthority() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) return _cache;

  try {
    const rows = await prisma.sourceAuthority.findMany();
    const defaultRow = rows.find(r => r.channelUsername === '__default__');
    const obj = { default: defaultRow ? defaultRow.authority : 0.5 };
    for (const r of rows) {
      if (r.channelUsername !== '__default__') obj[r.channelUsername] = r.authority;
    }
    _cache = obj;
    _cacheAt = now;
    return obj;
  } catch {
    // DB unavailable — return fallback
    return _cache || { default: 0.5 };
  }
}

function getAuthority(sourceAuthority, username) {
  return sourceAuthority[username] ?? sourceAuthority.default ?? 0.5;
}

module.exports = { loadSourceAuthority, getAuthority };
