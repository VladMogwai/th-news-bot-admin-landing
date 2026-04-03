import { useEffect, useState } from 'react';
import api from '../api/axios';
import Spinner from '../components/Spinner';

const DEFAULTS = {
  bot_token:           '',
  target_channel_id:   '',
  posting_interval:    '300',
  max_posts_per_hour:  '10',
  dedup_window_days:   '7',
  ad_filter_enabled:   'false',
  ad_keywords:         '',
  grok_filter_enabled: 'false',
  grok_api_key:        '',
  tg_api_id:           '',
  tg_api_hash:         '',
};

export default function Settings() {
  const [form, setForm]     = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(''); // '' | 'saved' | 'error'

  // Telegram auth state
  const [tgConnected, setTgConnected]   = useState(false);
  const [tgPhone, setTgPhone]           = useState('');
  const [tgCode, setTgCode]             = useState('');
  const [tgStep, setTgStep]             = useState('idle'); // 'idle' | 'code' | 'loading'
  const [tgError, setTgError]           = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/settings').then(({ data }) => setForm((p) => ({ ...p, ...data }))),
      api.get('/telegram/status').then(({ data }) => setTgConnected(data.connected)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) =>
    setForm((p) => ({
      ...p,
      [key]: e.target.type === 'checkbox' ? String(e.target.checked) : e.target.value,
    }));

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      await api.patch('/settings', form);
      setStatus('saved');
      setTimeout(() => setStatus(''), 2500);
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleTgSendCode = async () => {
    setTgError('');
    setTgStep('loading');
    try {
      await api.post('/telegram/auth/start', { phone: tgPhone });
      setTgStep('code');
    } catch (e) {
      setTgError(e?.response?.data?.error || 'Error sending code');
      setTgStep('idle');
    }
  };

  const handleTgConfirm = async () => {
    setTgError('');
    setTgStep('loading');
    try {
      await api.post('/telegram/auth/confirm', { phone: tgPhone, code: tgCode });
      setTgConnected(true);
      setTgStep('idle');
      setTgPhone('');
      setTgCode('');
    } catch (e) {
      setTgError(e?.response?.data?.error || 'Wrong code');
      setTgStep('code');
    }
  };

  const handleTgLogout = async () => {
    await api.post('/telegram/auth/logout').catch(() => {});
    setTgConnected(false);
    setTgStep('idle');
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-xl">
      <h2 className="text-white text-xl font-bold mb-6">Settings</h2>

      {/* General */}
      <Section title="General">
        <Field label="Bot Token">
          <input
            type="password"
            value={form.bot_token}
            onChange={set('bot_token')}
            placeholder="123456789:AAF..."
            className="input"
          />
        </Field>
        <Field label="Target Channel ID">
          <input
            type="text"
            value={form.target_channel_id}
            onChange={set('target_channel_id')}
            placeholder="-100123456789"
            className="input"
          />
        </Field>
        <Field label="Posting Interval (seconds)">
          <input
            type="number"
            value={form.posting_interval}
            onChange={set('posting_interval')}
            min="1"
            className="input"
          />
        </Field>
        <Field label="Max Posts per Hour">
          <input
            type="number"
            value={form.max_posts_per_hour}
            onChange={set('max_posts_per_hour')}
            min="1"
            className="input"
          />
        </Field>
        <Field label="Dedup Window (days)">
          <input
            type="number"
            value={form.dedup_window_days}
            onChange={set('dedup_window_days')}
            min="0"
            className="input"
          />
        </Field>
      </Section>

      {/* Ad Filter */}
      <Section title="Ad Filter">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400 text-sm">Enable Ad Filter</span>
          <button
            type="button"
            onClick={() =>
              setForm((p) => ({
                ...p,
                ad_filter_enabled: String(p.ad_filter_enabled !== 'true'),
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.ad_filter_enabled === 'true' ? 'bg-[#2563eb]' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.ad_filter_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <Field label="Custom Ad Keywords (one per line)">
          <textarea
            value={form.ad_keywords}
            onChange={set('ad_keywords')}
            rows={6}
            placeholder={'sponsored\nadvertisement\npromo'}
            className="input resize-none"
          />
        </Field>
      </Section>

      {/* Grok Ad Filter */}
      <Section title="Grok AI Ad Filter">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400 text-sm">Enable Grok Filter</span>
          <button
            type="button"
            onClick={() =>
              setForm((p) => ({
                ...p,
                grok_filter_enabled: String(p.grok_filter_enabled !== 'true'),
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.grok_filter_enabled === 'true' ? 'bg-[#2563eb]' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.grok_filter_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <Field label="Grok API Key">
          <input
            type="password"
            value={form.grok_api_key}
            onChange={set('grok_api_key')}
            placeholder="xai-..."
            className="input"
          />
        </Field>
        <p className="text-gray-600 text-xs mt-1">
          Получить ключ: console.x.ai → API Keys
        </p>
      </Section>

      {/* Telegram Account */}
      <Section title="Telegram Account (Private Channels)">
        <Field label="API ID">
          <input
            type="text"
            value={form.tg_api_id}
            onChange={set('tg_api_id')}
            placeholder="From my.telegram.org"
            className="input"
          />
        </Field>
        <Field label="API Hash">
          <input
            type="password"
            value={form.tg_api_hash}
            onChange={set('tg_api_hash')}
            placeholder="From my.telegram.org"
            className="input"
          />
        </Field>
        <div className="pt-2 border-t border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded ${tgConnected ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
              {tgConnected ? 'Connected' : 'Not connected'}
            </span>
            {tgConnected && (
              <button onClick={handleTgLogout} className="text-red-500 hover:text-red-400 text-xs">
                Disconnect
              </button>
            )}
          </div>
          {!tgConnected && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tgPhone}
                  onChange={(e) => setTgPhone(e.target.value)}
                  placeholder="+79001234567"
                  className="input flex-1"
                  disabled={tgStep === 'code' || tgStep === 'loading'}
                />
                <button
                  onClick={handleTgSendCode}
                  disabled={!tgPhone || tgStep === 'code' || tgStep === 'loading'}
                  className="btn-primary text-sm px-4 disabled:opacity-50"
                >
                  {tgStep === 'loading' && tgStep !== 'code' ? '...' : 'Send Code'}
                </button>
              </div>
              {tgStep === 'code' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tgCode}
                    onChange={(e) => setTgCode(e.target.value)}
                    placeholder="Code from Telegram"
                    className="input flex-1"
                  />
                  <button
                    onClick={handleTgConfirm}
                    disabled={!tgCode || tgStep === 'loading'}
                    className="btn-primary text-sm px-4 disabled:opacity-50"
                  >
                    {tgStep === 'loading' ? '...' : 'Confirm'}
                  </button>
                </div>
              )}
              {tgError && <p className="text-red-400 text-xs">{tgError}</p>}
            </div>
          )}
        </div>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-6 py-2 text-sm"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {status === 'saved' && <span className="text-green-400 text-sm">Saved!</span>}
        {status === 'error' && <span className="text-red-500 text-sm">Failed to save</span>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5 mb-4">
      <h3 className="text-gray-300 font-semibold mb-4 text-sm uppercase tracking-wide">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-gray-400 text-sm mb-1">{label}</label>
      {children}
    </div>
  );
}
