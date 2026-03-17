import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scrapeUrl } from '../../lib/webScraper';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as Record<string, unknown>;

  const url =
    typeof body['url'] === 'string' ? body['url'].trim() : null;

  const selectors =
    typeof body['selectors'] === 'object' &&
    body['selectors'] !== null &&
    !Array.isArray(body['selectors'])
      ? (body['selectors'] as Record<string, string>)
      : undefined;

  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: 'url is not a valid URL' });
    return;
  }

  try {
    const result = await scrapeUrl(url, selectors);
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Scraping failed: ${message}` });
  }
}
