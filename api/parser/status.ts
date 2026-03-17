import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getJob } from '../../lib/jobQueue';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const query = req.query as Record<string, string | string[]>;
  const rawJobId = query['jobId'];
  const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;

  if (!jobId) {
    res.status(400).json({ error: 'jobId is required' });
    return;
  }

  try {
    const job = await getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.status(200).json(job);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to fetch job: ${message}` });
  }
}
