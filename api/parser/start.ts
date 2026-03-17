import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createJob, runJob } from '../../lib/jobQueue';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const channelUsername =
    typeof body['channelUsername'] === 'string'
      ? body['channelUsername'].trim()
      : null;

  const limit =
    typeof body['limit'] === 'number' && body['limit'] > 0
      ? Math.min(body['limit'], 1000)
      : 100;

  if (!channelUsername) {
    res.status(400).json({ error: 'channelUsername is required' });
    return;
  }

  let jobId: string;
  try {
    jobId = await createJob(channelUsername);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to create job: ${message}` });
    return;
  }

  // Fire and forget — do not await
  setImmediate(() => {
    void runJob(jobId, channelUsername, limit);
  });

  res.status(200).json({ jobId });
}
