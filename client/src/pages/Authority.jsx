import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import Spinner from '../components/Spinner';
import Overlay from '../components/Overlay';

function authorityColor(v) {
  if (v >= 0.7) return 'text-green-400';
  if (v >= 0.4) return 'text-yellow-400';
  return 'text-red-400';
}

function authorityBg(v) {
  if (v >= 0.7) return 'bg-green-500';
  if (v >= 0.4) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function Authority() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [toast, setToast]     = useState('');
  const [form, setForm]       = useState({ channelUsername: '', label: '', authority: 0.5 });
  const [adding, setAdding]   = useState(false);

  const debounceRefs = useRef({});

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = async () => {
    try {
      const { data } = await api.get('/authority');
      setRows(data);
    } catch {}
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.channelUsername.startsWith('@')) {
      showToast('Username must start with @');
      return;
    }
    setAdding(true);
    setBusy(true);
    try {
      await api.post('/authority', form);
      setForm({ channelUsername: '', label: '', authority: 0.5 });
      await load();
      showToast('Added');
    } catch (err) {
      showToast(err?.response?.data?.error || 'Error');
    } finally { setAdding(false); setBusy(false); }
  };

  const handleDelete = async (id) => {
    setBusy(true);
    try {
      await api.delete(`/authority/${id}`);
      setRows(r => r.filter(x => x.id !== id));
    } catch {} finally { setBusy(false); }
  };

  const handleSlider = (id, value) => {
    // optimistic UI
    setRows(r => r.map(x => x.id === id ? { ...x, authority: value } : x));

    // debounced save
    clearTimeout(debounceRefs.current[id]);
    debounceRefs.current[id] = setTimeout(async () => {
      try { await api.patch(`/authority/${id}`, { authority: value }); }
      catch { showToast('Save failed'); }
    }, 800);
  };

  if (loading) return <Spinner />;

  const display = rows.filter(r => r.channelUsername !== '__default__');
  const defaultRow = rows.find(r => r.channelUsername === '__default__');

  return (
    <div className="max-w-2xl">
      <Overlay isOpen={busy} />

      {toast && (
        <div className="mb-4 bg-[#1e3a5f] border border-[#2563eb55] text-[#93c5fd] rounded-lg px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      <h2 className="text-white text-xl font-bold mb-1">Source Authority</h2>
      <p className="text-gray-500 text-sm mb-6">
        Управление весами источников для scoring pipeline.
      </p>

      {/* Default fallback */}
      {defaultRow && (
        <div className="bg-[#161b22] border border-gray-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Default fallback</span>
            <span className={`font-mono font-bold text-sm ${authorityColor(defaultRow.authority)}`}>
              {defaultRow.authority.toFixed(2)}
            </span>
          </div>
          <SliderRow value={defaultRow.authority} onChange={v => handleSlider(defaultRow.id, v)} />
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-[#161b22] border border-gray-800 rounded-lg p-4 mb-4 space-y-3">
        <h3 className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Add source</h3>
        <div className="flex gap-2">
          <input
            placeholder="@channel"
            value={form.channelUsername}
            onChange={e => setForm(p => ({ ...p, channelUsername: e.target.value }))}
            className="input"
            style={{ maxWidth: 160 }}
          />
          <input
            placeholder="Label (optional)"
            value={form.label}
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            className="input flex-1"
          />
        </div>
        <div className="flex items-center gap-3">
          <SliderRow value={form.authority} onChange={v => setForm(p => ({ ...p, authority: v }))} />
          <span className={`font-mono text-sm w-10 text-right ${authorityColor(form.authority)}`}>
            {form.authority.toFixed(2)}
          </span>
        </div>
        <button type="submit" disabled={adding} className="btn-primary px-4 py-2 text-sm">
          + Add
        </button>
      </form>

      {/* Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide text-left">
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Authority</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {display.map(row => (
              <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-800/20">
                <td className="px-4 py-3 font-mono text-white text-xs">{row.channelUsername}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{row.label || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all ${authorityBg(row.authority)}`}
                        style={{ width: `${row.authority * 100}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0} max={1} step={0.05}
                      value={row.authority}
                      onChange={e => handleSlider(row.id, parseFloat(e.target.value))}
                      className="w-24 accent-[#6366f1] cursor-pointer"
                    />
                    <span className={`font-mono text-xs w-8 text-right ${authorityColor(row.authority)}`}>
                      {row.authority.toFixed(2)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="text-red-500 hover:text-red-400 text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {display.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-600 text-sm">
                  No sources yet. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SliderRow({ value, onChange }) {
  return (
    <input
      type="range"
      min={0} max={1} step={0.05}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="flex-1 accent-[#6366f1] cursor-pointer"
    />
  );
}
