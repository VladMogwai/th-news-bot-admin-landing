const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { getClient } = require('./telegramClient');

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
    const hashSource = content !== '[media]' ? content : `[media]:${id}`;
    const contentHash = crypto.createHash('sha256').update(hashSource).digest('hex');
    posts.push({ externalId: id, content, mediaUrls, contentHash });
  });

  return posts;
}

async function scrapePrivateTelegram(channelId) {
  const client = await getClient();
  if (!client) throw new Error('Telegram user client not connected. Set up auth in Settings.');

  const entity = await client.getEntity(channelId);
  const messages = await client.getMessages(entity, { limit: 30 });

  const posts = [];
  for (const msg of messages) {
    if (!msg.message && !msg.media) continue;

    const content = msg.message || '[media]';
    const externalId = String(msg.id);
    const hashSource = content !== '[media]' ? content : `[media]:${externalId}`;
    const contentHash = crypto.createHash('sha256').update(hashSource).digest('hex');
    posts.push({ externalId, content, mediaUrls: [], contentHash });
  }

  return posts;
}

async function isAdByGrok(content, apiKey) {
  if (!content || content === '[media]') return false;
  try {
    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: `Is the following Telegram post an advertisement, sponsored content, or promotion? Reply with only "yes" or "no".\n\n${content.slice(0, 1000)}`,
          },
        ],
        max_tokens: 5,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    const answer = data.choices?.[0]?.message?.content?.trim().toLowerCase() || '';
    return answer.startsWith('yes');
  } catch (e) {
    console.error('Grok ad filter error:', e.message);
    return false;
  }
}

async function fetchSource(source) {
  let posts = [];

  if (source.type === 'telegram') {
    posts = await scrapeTelegram(source.url);
  } else if (source.type === 'telegram_private' || source.type === 'telegram_mtproto') {
    posts = await scrapePrivateTelegram(source.url);
  }

  const settings = await prisma.botSettings.findMany();
  const cfg = Object.fromEntries(settings.map(r => [r.key, r.value]));
  const adFilterEnabled = cfg['ad_filter_enabled'] !== 'false';
  const adKeywords = (cfg['ad_keywords'] || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const grokFilterEnabled = cfg['grok_filter_enabled'] === 'true';
  const grokApiKey = process.env.GROQ_API_KEY || cfg['grok_api_key'] || '';

  const newPosts = [];
  for (const post of posts) {
    if (adFilterEnabled && adKeywords.some(kw => post.content.toLowerCase().includes(kw.toLowerCase()))) continue;
    if (grokFilterEnabled && grokApiKey && await isAdByGrok(post.content, grokApiKey)) continue;

    try {
      const created = await prisma.post.create({
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
      newPosts.push(created);
    } catch (e) {
      if (e.code !== 'P2002') console.error('Insert error:', e.message);
    }
  }

  await prisma.source.update({
    where: { id: source.id },
    data: { lastScrapedAt: new Date() },
  });

  return newPosts;
}

async function fetchAllSources() {
  const sources = await prisma.source.findMany({ where: { status: 'active' } });
  const results = [];
  for (const source of sources) {
    try {
      const newPosts = await fetchSource(source);
      results.push({ id: source.id, name: source.name, added: newPosts.length });
    } catch (err) {
      console.error(`Error scraping ${source.name}:`, err.message);
      results.push({ id: source.id, name: source.name, error: err.message });
    }
  }
  return results;
}

module.exports = { fetchAllSources, fetchSource };
