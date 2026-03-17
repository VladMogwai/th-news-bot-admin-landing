import { getTelegramClient, throttledRequest, supabase } from './telegramClient';

export interface ParsedMessage {
  messageId: number;
  channelId: number;
  text: string | null;
  mediaUrl: string | null;
  views: number;
  forwards: number;
  forwardFromName: string | null;
  forwardFromChannel: string | null;
  date: Date;
  raw: object;
}

export interface ParseResult {
  channelUsername: string;
  channelId: number;
  newMessages: number;
  totalMessages: number;
  lastMessageId: number;
}

interface ChannelRow {
  channel_id: number | null;
  last_message_id: number;
  last_parsed_at: string | null;
  total_messages: number;
}

async function getOrCreateChannel(
  channelUsername: string,
): Promise<{ channel_id: bigint | null; last_message_id: bigint }> {
  const { data, error } = await supabase
    .from('parsed_channels')
    .upsert(
      { channel_username: channelUsername },
      { onConflict: 'channel_username', ignoreDuplicates: true },
    )
    .select('channel_id, last_message_id, last_parsed_at, total_messages')
    .single();

  if (error || !data) {
    // Row may already exist — fetch it
    const { data: existing, error: fetchError } = await supabase
      .from('parsed_channels')
      .select('channel_id, last_message_id, last_parsed_at, total_messages')
      .eq('channel_username', channelUsername)
      .single();

    if (fetchError || !existing) {
      return { channel_id: null, last_message_id: BigInt(0) };
    }

    const row = existing as ChannelRow;
    return {
      channel_id: row.channel_id != null ? BigInt(row.channel_id) : null,
      last_message_id: BigInt(row.last_message_id ?? 0),
    };
  }

  const row = data as ChannelRow;
  return {
    channel_id: row.channel_id != null ? BigInt(row.channel_id) : null,
    last_message_id: BigInt(row.last_message_id ?? 0),
  };
}

async function getChannelCacheInfo(
  channelUsername: string,
): Promise<{ last_parsed_at: string | null; total_messages: number; last_message_id: number } | null> {
  const { data } = await supabase
    .from('parsed_channels')
    .select('last_parsed_at, total_messages, last_message_id')
    .eq('channel_username', channelUsername)
    .single();

  if (!data) return null;
  return data as { last_parsed_at: string | null; total_messages: number; last_message_id: number };
}

function extractMediaUrl(message: unknown): string | null {
  if (typeof message !== 'object' || message === null) return null;

  const msg = message as Record<string, unknown>;
  const media = msg['media'];

  if (typeof media !== 'object' || media === null) return null;

  const mediaObj = media as Record<string, unknown>;

  // Check for photo
  if (mediaObj['photo'] != null) {
    const photo = mediaObj['photo'] as Record<string, unknown>;
    if (typeof photo['id'] === 'bigint' || typeof photo['id'] === 'number') {
      return `tg://photo/${String(photo['id'])}`;
    }
  }

  // Check for document
  if (mediaObj['document'] != null) {
    const doc = mediaObj['document'] as Record<string, unknown>;
    if (typeof doc['id'] === 'bigint' || typeof doc['id'] === 'number') {
      return `tg://document/${String(doc['id'])}`;
    }
  }

  return null;
}

function extractForwardInfo(
  message: unknown,
): { forwardFromName: string | null; forwardFromChannel: string | null } {
  const empty = { forwardFromName: null, forwardFromChannel: null };

  if (typeof message !== 'object' || message === null) return empty;

  const msg = message as Record<string, unknown>;
  const fwdFrom = msg['fwdFrom'];

  if (typeof fwdFrom !== 'object' || fwdFrom === null) return empty;

  const fwd = fwdFrom as Record<string, unknown>;

  const forwardFromName =
    typeof fwd['fromName'] === 'string' ? fwd['fromName'] : null;

  let forwardFromChannel: string | null = null;
  if (fwd['channelPost'] != null) {
    forwardFromChannel = String(fwd['channelPost']);
  }

  return { forwardFromName, forwardFromChannel };
}

export async function parseChannel(
  channelUsername: string,
  limit = 100,
): Promise<ParseResult> {
  const username = channelUsername.startsWith('@')
    ? channelUsername
    : `@${channelUsername}`;

  // Check cache — skip fetch if parsed within the last 5 minutes
  const cacheInfo = await getChannelCacheInfo(channelUsername);
  if (cacheInfo?.last_parsed_at) {
    const lastParsed = new Date(cacheInfo.last_parsed_at).getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (lastParsed > fiveMinutesAgo) {
      return {
        channelUsername,
        channelId: 0,
        newMessages: 0,
        totalMessages: cacheInfo.total_messages ?? 0,
        lastMessageId: cacheInfo.last_message_id ?? 0,
      };
    }
  }

  const client = await getTelegramClient();

  const entity = await throttledRequest(() => client.getEntity(username));

  const entityObj = entity as unknown as Record<string, unknown>;
  const channelId: number =
    typeof entityObj['id'] === 'bigint'
      ? Number(entityObj['id'])
      : typeof entityObj['id'] === 'number'
      ? entityObj['id']
      : 0;

  const { last_message_id } = await getOrCreateChannel(channelUsername);
  const offsetId = Number(last_message_id);

  const batch: Array<{
    channel_id: number;
    message_id: number;
    text: string | null;
    media_url: string | null;
    views: number;
    forwards: number;
    forward_from_name: string | null;
    forward_from_channel: string | null;
    date: string;
    raw: object;
  }> = [];

  let newMaxMessageId = offsetId;

  for await (const message of client.iterMessages(entity, {
    limit,
    offsetId,
  })) {
    const msg = message as unknown as Record<string, unknown>;

    const messageId: number =
      typeof msg['id'] === 'number' ? msg['id'] : 0;

    if (messageId === 0) continue;

    if (messageId > newMaxMessageId) {
      newMaxMessageId = messageId;
    }

    const text: string | null =
      typeof msg['message'] === 'string' && msg['message'].length > 0
        ? msg['message']
        : typeof msg['text'] === 'string' && msg['text'].length > 0
        ? msg['text']
        : null;

    const views: number =
      typeof msg['views'] === 'number' ? msg['views'] : 0;
    const forwards: number =
      typeof msg['forwards'] === 'number' ? msg['forwards'] : 0;

    const rawDate = msg['date'];
    const date: string =
      rawDate instanceof Date
        ? rawDate.toISOString()
        : typeof rawDate === 'number'
        ? new Date(rawDate * 1000).toISOString()
        : new Date().toISOString();

    const mediaUrl = extractMediaUrl(message);
    const { forwardFromName, forwardFromChannel } = extractForwardInfo(message);

    batch.push({
      channel_id: channelId,
      message_id: messageId,
      text,
      media_url: mediaUrl,
      views,
      forwards,
      forward_from_name: forwardFromName,
      forward_from_channel: forwardFromChannel,
      date,
      raw: msg as object,
    });
  }

  if (batch.length > 0) {
    await supabase
      .from('parsed_messages')
      .upsert(batch, { onConflict: 'channel_id,message_id' });
  }

  const now = new Date().toISOString();

  const { data: currentChannel } = await supabase
    .from('parsed_channels')
    .select('total_messages')
    .eq('channel_username', channelUsername)
    .single();

  const currentTotal =
    (currentChannel as { total_messages: number } | null)?.total_messages ?? 0;
  const newTotal = currentTotal + batch.length;

  await supabase
    .from('parsed_channels')
    .update({
      channel_id: channelId,
      last_message_id: newMaxMessageId,
      last_parsed_at: now,
      total_messages: newTotal,
    })
    .eq('channel_username', channelUsername);

  return {
    channelUsername,
    channelId,
    newMessages: batch.length,
    totalMessages: newTotal,
    lastMessageId: newMaxMessageId,
  };
}
