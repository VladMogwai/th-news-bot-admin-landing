CREATE TABLE IF NOT EXISTS parsed_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_username text UNIQUE NOT NULL,
  channel_id bigint,
  last_message_id bigint DEFAULT 0,
  last_parsed_at timestamptz,
  total_messages int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS parsed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id bigint NOT NULL,
  message_id bigint NOT NULL,
  text text,
  media_url text,
  views int,
  forwards int,
  forward_from_name text,
  forward_from_channel text,
  date timestamptz,
  raw jsonb,
  UNIQUE(channel_id, message_id)
);

CREATE TABLE IF NOT EXISTS parse_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text DEFAULT 'pending',
  channel_username text,
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_phone text UNIQUE NOT NULL,
  session_string text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);
