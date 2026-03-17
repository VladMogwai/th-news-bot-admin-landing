import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { FloodWaitError } from 'telegram/errors';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getSession(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('session_string')
      .order('last_used_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return process.env.TELEGRAM_SESSION ?? '';
    }

    return (data as { session_string: string }).session_string;
  } catch {
    return process.env.TELEGRAM_SESSION ?? '';
  }
}

async function updateSessionLastUsed(sessionString: string): Promise<void> {
  try {
    await supabase
      .from('sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('session_string', sessionString);
  } catch {
    // Non-critical — silently ignore
  }
}

let _client: TelegramClient | null = null;

export async function getTelegramClient(): Promise<TelegramClient> {
  if (_client && _client.connected) {
    return _client;
  }

  const apiId = parseInt(process.env.TELEGRAM_API_ID ?? '0', 10);
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';
  const sessionString = await getSession();

  const session = new StringSession(sessionString);

  _client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await _client.connect();
  await updateSessionLastUsed(sessionString);

  return _client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withFloodWait<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
): Promise<T> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (err instanceof FloodWaitError) {
        const waitSeconds = err.seconds + 5;
        console.warn(`FloodWaitError: waiting ${waitSeconds}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(waitSeconds * 1000);
        attempt++;
        continue;
      }

      // Exponential backoff for other transient errors
      const backoff = Math.pow(2, attempt) * 1000;
      attempt++;

      if (attempt >= maxRetries) {
        throw err;
      }

      console.warn(`Error on attempt ${attempt}/${maxRetries}, retrying in ${backoff}ms:`, err);
      await sleep(backoff);
    }
  }

  throw new Error(`withFloodWait: exhausted ${maxRetries} retries`);
}

export async function throttledRequest<T>(fn: () => Promise<T>): Promise<T> {
  const delay = 1000 + Math.random() * 2000; // 1000–3000ms
  await sleep(delay);
  return withFloodWait(fn);
}
