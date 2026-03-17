import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  title: string;
  content: string;
  extractedData: Record<string, string>;
  scrapedAt: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeUrl(
  url: string,
  selectors?: Record<string, string>,
  timeout = 10000,
): Promise<ScrapeResult> {
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get<string>(url, {
        timeout,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; TH-News-Bot/1.0; +https://github.com/th-news-bot)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        maxRedirects: 5,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Extract title
      const title = $('title').first().text().trim();

      // Extract main content — prefer article, then main, then body
      let content = '';
      if ($('article').length > 0) {
        content = $('article').first().text().trim();
      } else if ($('main').length > 0) {
        content = $('main').first().text().trim();
      } else {
        content = $('body').text().trim();
      }

      // Normalize whitespace
      content = content.replace(/\s+/g, ' ').trim();

      // Apply custom selectors
      const extractedData: Record<string, string> = {};
      if (selectors) {
        for (const [key, selector] of Object.entries(selectors)) {
          const el = $(selector);
          if (el.length > 0) {
            extractedData[key] = el.first().text().trim();
          } else {
            extractedData[key] = '';
          }
        }
      }

      return {
        title,
        content,
        extractedData,
        scrapedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      lastError = err;

      if (attempt < maxRetries - 1) {
        await sleep(2000);
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`scrapeUrl failed after ${maxRetries} attempts: ${message}`);
}
