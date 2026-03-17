import { supabase } from './telegramClient';
import { parseChannel } from './telegramParser';

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  channel_username: string | null;
  result: object | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function createJob(channelUsername: string): Promise<string> {
  const { data, error } = await supabase
    .from('parse_jobs')
    .insert({
      status: 'pending' as JobStatus,
      channel_username: channelUsername,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create job: ${error?.message ?? 'unknown error'}`,
    );
  }

  return (data as { id: string }).id;
}

export async function updateJob(
  jobId: string,
  status: JobStatus,
  result?: object,
  error?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (result !== undefined) {
    update['result'] = result;
  }
  if (error !== undefined) {
    update['error'] = error;
  }

  await supabase.from('parse_jobs').update(update).eq('id', jobId);
}

export async function getJob(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('parse_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Job;
}

export async function runJob(
  jobId: string,
  channelUsername: string,
  limit: number,
): Promise<void> {
  await updateJob(jobId, 'running');

  try {
    const result = await parseChannel(channelUsername, limit);
    await updateJob(jobId, 'done', result as unknown as object);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    await updateJob(jobId, 'failed', undefined, message);
  }
}
