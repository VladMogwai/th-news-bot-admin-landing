import { useEffect, useState } from 'react';
import api from '../api/axios';
import Spinner from '../components/Spinner';

const DEFAULTS = {
  bot_token:          '',
  target_channel_id:  '',
  posting_interval:   '300',
  max_posts_per_hour: '10',
  dedup_window_days:  '7',
  ad_filter_enabled:  'false',
  ad_keywords:        '',
};

export default function Settings() {
  const [form, setForm]     = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(''); // '' | 'saved' | 'error'

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setForm((p) => ({ ...p, ...data })))
      .catch(() => {})
      .finally(() => setLoading(false));
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
