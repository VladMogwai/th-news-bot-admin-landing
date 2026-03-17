import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const sessionString = process.env.TELEGRAM_SESSION;
  if (!sessionString) {
    console.error('ERROR: TELEGRAM_SESSION environment variable is not set.');
    process.exit(1);
  }

  const accountPhone = process.env.ACCOUNT_PHONE ?? 'unknown';

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      'ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required.',
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase.from('sessions').upsert(
    {
      account_phone: accountPhone,
      session_string: sessionString,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'account_phone' },
  );

  if (error) {
    console.error('ERROR: Failed to upsert session:', error.message);
    process.exit(1);
  }

  console.log(
    `SUCCESS: Session migrated for account "${accountPhone}" (session length: ${sessionString.length} chars).`,
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Unhandled error:', message);
  process.exit(1);
});
