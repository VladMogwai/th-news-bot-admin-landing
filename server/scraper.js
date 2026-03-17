const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function extractTextWithLinks($, el) {
  const textEl = $(el).find('.tgme_widget_message_text');
  if (textEl.length === 0) return '';

  let result = '';
  textEl.contents().each(function walk(_, node) {
    if (node.type === 'text') {
      result += node.data;
    } else if (node.type === 'tag') {
      if (node.name === 'a') {
        const innerText = $(node).text().trim();
        if (innerText && !innerText.startsWith('http')) result += innerText;
      } else if (node.name === 'br') {
        result += '\n';
      } else {
        $(node).contents().each(walk);
      }
    }
  });

  return result.trim();
}

async function scrapeTelegram(channelUrl) {
  const username = channelUrl.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '').replace(/\/$/, '');
  const { data } = await axios.get(`https://t.me/s/${username}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  });

  const $ = cheerio.load(data);
  const posts = [];

  $('.tgme_widget_message').each((_, el) => {
    const id = $(el).attr('data-post') || '';
    const text = extractTextWithLinks($, el);
    const mediaUrls = [];

    $(el).find('a.tgme_widget_message_photo_wrap').each((_, a) => {
      const style = $(a).attr('style') || '';
      const match = style.match(/url\('(.+?)'\)/);
      if (match) mediaUrls.push(match[1]);
    });

    if (!text && mediaUrls.length === 0) return;

    const content = text || '[media]';
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    posts.push({ externalId: id, content, mediaUrls, contentHash });
  });

  return posts;
}

async function fetchSource(source) {
  let posts = [];

  if (source.type === 'telegram') {
    posts = await scrapeTelegram(source.url);
  }

  const settings = await prisma.botSettings.findMany();
  const cfg = Object.fromEntries(settings.map(r => [r.key, r.value]));
  const adFilterEnabled = cfg['ad_filter_enabled'] !== 'false';
  const adKeywords = (cfg['ad_keywords'] || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);

  let added = 0;
  for (const post of posts) {
    if (adFilterEnabled && adKeywords.some(kw => post.content.toLowerCase().includes(kw.toLowerCase()))) continue;

    try {
      await prisma.post.create({
        data: {
          sourceId: source.id,
          externalId: post.externalId,
          content: post.content,
          mediaUrls: post.mediaUrls,
          contentHash: post.contentHash,
          isSent: false,
          ignored: false,
        },
      });
      added++;
    } catch (e) {
      if (e.code !== 'P2002') console.error('Insert error:', e.message);
    }
  }

  await prisma.source.update({
    where: { id: source.id },
    data: { lastScrapedAt: new Date() },
  });

  return added;
}

async function fetchAllSources() {
  const sources = await prisma.source.findMany({ where: { status: 'active' } });
  const results = [];
  for (const source of sources) {
    try {
      const added = await fetchSource(source);
      results.push({ id: source.id, name: source.name, added });
    } catch (err) {
      console.error(`Error scraping ${source.name}:`, err.message);
      results.push({ id: source.id, name: source.name, error: err.message });
    }
  }
  return results;
}

module.exports = { fetchAllSources, fetchSource };
