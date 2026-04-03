import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/axios';
import Spinner from '../components/Spinner';

export default function Sources() {
  const [sources, setSources]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState(null); // full source object
  const [posts, setPosts]               = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [newSrc, setNewSrc]             = useState({ name: '', url: '', type: 'telegram' });
  const [adding, setAdding]             = useState(false);
  const [checkedIds, setCheckedIds]     = useState(new Set());
  const [countdown, setCountdown]       = useState('');
  const [postingInterval, setPostingInterval] = useState(null);
  const [fetchingId, setFetchingId]     = useState(null);
  const [fetchingAll, setFetchingAll]   = useState(false);
  const [toast, setToast]               = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // ── Load sources ────────────────────────────────────────────────────────────
  const loadSources = useCallback(async () => {
    try {
      const { data } = await api.get('/sources');
      setSources(data);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      loadSources(),
      api.get('/settings').then(({ data }) => {
        const sec = parseInt(data.posting_interval);
        if (!isNaN(sec) && sec > 0) setPostingInterval(sec);
      }).catch(() => {}),
    ]).then(async () => {
      setLoading(false);
      // auto fetch all on page load
      const { data: srcs } = await api.get('/sources');
      if (srcs.length === 0) return;
      setFetchingAll(true);
      try {
        const results = await Promise.allSettled(srcs.map((s) => api.post(`/sources/${s.id}/fetch`)));
        const totalAdded = results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? (r.value.data.added || 0) : 0), 0);
        if (totalAdded > 0) showToast(`Auto-fetch: found ${totalAdded} new post(s)`);
        const { data: fresh } = await api.get('/sources');
        setSources(fresh);
      } catch {}
      setFetchingAll(false);
    });
  }, [loadSources]);

  // ── Countdown based on posting interval ─────────────────────────────────────
  useEffect(() => {
    if (!postingInterval) return;
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const rem = postingInterval - (nowSec % postingInterval);
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      setCountdown(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [postingInterval]);

  // ── Load posts when source selected ─────────────────────────────────────────
  useEffect(() => {
    if (!selected) { setPosts([]); return; }
    setLoadingPosts(true);
    api.get(`/sources/${selected.id}/posts`)
      .then(({ data }) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false));
  }, [selected]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newSrc.name || !newSrc.url) return;
    setAdding(true);
    try {
      await api.post('/sources', newSrc);
      setNewSrc({ name: '', url: '', type: 'telegram' });
      await loadSources();
    } catch {}
    setAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this source and all its data?')) return;
    await api.delete(`/sources/${id}`).catch(() => {});
    if (selected?.id === id) setSelected(null);
    await loadSources();
  };

  const handleClear = async (id) => {
    await api.post('/sources/bulk', { action: 'clear', sourceIds: [id] }).catch(() => {});
    await loadSources();
    if (selected?.id === id) {
      const { data } = await api.get(`/sources/${id}/posts`);
      setPosts(data);
    }
  };

  const handleBulkAction = async (action) => {
    if (!checkedIds.size) return;
    if (action === 'delete' && !confirm(`Delete ${checkedIds.size} source(s)?`)) return;
    await api.post('/sources/bulk', { action, sourceIds: [...checkedIds] }).catch(() => {});
    if (action === 'delete' && checkedIds.has(selected?.id)) setSelected(null);
    setCheckedIds(new Set());
    await loadSources();
  };

  const handleSendAll = async () => {
    await api.post('/sources/bulk', { action: 'send', sourceIds: sources.map((s) => s.id) });
    await loadSources();
    if (selected) {
      const { data } = await api.get(`/sources/${selected.id}/posts`);
      setPosts(data);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all pending posts from all sources?')) return;
    await api.post('/sources/bulk', { action: 'clear', sourceIds: sources.map((s) => s.id) });
    await loadSources();
    if (selected) setPosts([]);
  };

  const handleSendPost = async (postId) => {
    await api.post(`/sources/${selected.id}/posts/${postId}/send`).catch(() => {});
    setPosts((p) => p.filter((x) => x.id !== postId));
    loadSources();
  };

  const handleDeletePost = async (postId) => {
    await api.delete(`/sources/${selected.id}/posts/${postId}`).catch(() => {});
    setPosts((p) => p.filter((x) => x.id !== postId));
    loadSources();
  };

  const handleSendAllPosts = async () => {
    for (const p of posts) {
      await api.post(`/sources/${selected.id}/posts/${p.id}/send`).catch(() => {});
    }
    setPosts([]);
    loadSources();
  };

  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelect = (src) =>
    setSelected((prev) => (prev?.id === src.id ? null : src));

  // ── Resize panel ────────────────────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(480);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onResizerMouseDown = (e) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing.current) return;
      const diff = startX.current - e.clientX;
      setPanelWidth(Math.max(280, Math.min(900, startWidth.current + diff)));
    };
    const onMouseUp = () => { isResizing.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ── Fetch all sources ────────────────────────────────────────────────────────
  const handleFetchAll = async () => {
    if (fetchingAll || sources.length === 0) return;
    setFetchingAll(true);
    try {
      const results = await Promise.allSettled(sources.map((s) => api.post(`/sources/${s.id}/fetch`)));
      const totalAdded = results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? (r.value.data.added || 0) : 0), 0);
      showToast(`Fetched all: found ${totalAdded} new post(s)`);
      const { data: fresh } = await api.get('/sources');
      setSources(fresh);
      if (selected) {
        const { data: fetchedPosts } = await api.get(`/sources/${selected.id}/posts`);
        setPosts(fetchedPosts);
      }
    } catch (e) {
      showToast('Fetch all error');
    }
    setFetchingAll(false);
  };

  // ── Fetch posts for a source ─────────────────────────────────────────────────
  const handleFetch = async (id) => {
    setFetchingId(id);
    try {
      const { data } = await api.post(`/sources/${id}/fetch`);
      showToast(`Found ${data.added} new post(s)`);
      const [{ data: freshSources }, { data: fetchedPosts }] = await Promise.all([
        api.get('/sources'),
        api.get(`/sources/${id}/posts`),
      ]);
      setSources(freshSources);
      const src = freshSources.find((s) => s.id === id);
      if (src) setSelected(src);
      setPosts(fetchedPosts);
    } catch (e) {
      showToast(`Fetch error: ${e?.response?.data?.error || e.message || 'Unknown error'}`);
    } finally {
      setFetchingId(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Toast */}
      {toast && (
        <div className="bg-[#1e3a5f] border border-[#2563eb55] text-[#93c5fd] rounded-lg px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
      {/* ── Left: table ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 mr-0">
        {/* Top toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {countdown && (
            <span className="text-gray-500 text-xs">Next send in {countdown}</span>
          )}
          <div className="flex-1" />
          <button onClick={handleFetchAll} disabled={fetchingAll} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50">
            {fetchingAll ? 'Fetching...' : 'Fetch All'}
          </button>
          <button onClick={handleSendAll}  className="btn-primary  text-xs px-3 py-1.5">Send All</button>
          <button onClick={handleClearAll} className="btn-ghost    text-xs px-3 py-1.5">Clear All</button>
          {checkedIds.size > 0 && (
            <>
              <button onClick={() => handleBulkAction('clear')}  className="btn-ghost      text-xs px-3 py-1.5">Clear {checkedIds.size}</button>
              <button onClick={() => handleBulkAction('delete')} className="text-red-500 hover:text-red-400 text-xs px-3 py-1.5 rounded">Delete {checkedIds.size}</button>
            </>
          )}
        </div>

        {/* Add source form */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            placeholder="Name"
            value={newSrc.name}
            onChange={(e) => setNewSrc((p) => ({ ...p, name: e.target.value }))}
            className="input"
            style={{ maxWidth: '160px' }}
          />
          <input
            placeholder="URL or @handle"
            value={newSrc.url}
            onChange={(e) => setNewSrc((p) => ({ ...p, url: e.target.value }))}
            className="input flex-1"
          />
          <select
            value={newSrc.type}
            onChange={(e) => setNewSrc((p) => ({ ...p, type: e.target.value }))}
            className="input"
            style={{ width: '120px' }}
          >
            <option value="telegram">Telegram</option>
            <option value="telegram_mtproto">Telegram MTProto</option>
            <option value="telegram_private">Telegram Private</option>
            <option value="website">Website</option>
          </select>
          <button type="submit" disabled={adding} className="btn-primary px-4 py-2 text-sm whitespace-nowrap">
            + Add
          </button>
        </form>

        {/* Sources table */}
        <div className="bg-[#161b22] border border-gray-800 rounded-lg overflow-hidden flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left text-xs uppercase tracking-wide">
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last fetch</th>
                <th className="px-4 py-3">Pending</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src) => (
                <tr
                  key={src.id}
                  onClick={() => toggleSelect(src)}
                  className={`border-b border-gray-800 cursor-pointer transition-colors ${
                    selected?.id === src.id ? 'bg-blue-900/20' : 'hover:bg-gray-800/30'
                  }`}
                >
                  <td
                    className="px-3 py-3"
                    onClick={(e) => { e.stopPropagation(); toggleCheck(src.id); }}
                  >
                    <input
                      type="checkbox"
                      checked={checkedIds.has(src.id)}
                      onChange={() => {}}
                      className="accent-[#2563eb]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{src.name}</div>
                    <div className="text-gray-500 text-xs">{src.url}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      src.status === 'active'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-gray-800 text-gray-400'
                    }`}>
                      {src.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {src.lastScrapedAt ? new Date(src.lastScrapedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {src._count?.posts > 0 && (
                      <span className="bg-[#2563eb] text-white text-xs px-2 py-0.5 rounded-full">
                        {src._count.posts}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-right space-x-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleFetch(src.id)}
                      disabled={fetchingId === src.id}
                      className="text-blue-400 hover:text-blue-300 text-xs transition-colors disabled:opacity-50"
                    >
                      {fetchingId === src.id ? '...' : 'Fetch'}
                    </button>
                    <button
                      onClick={() => handleClear(src.id)}
                      className="text-gray-400 hover:text-white text-xs transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => handleDelete(src.id)}
                      className="text-red-500 hover:text-red-400 text-xs transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-600">
                    No sources yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Resizer ──────────────────────────────────────────────────────── */}
      {selected && (
        <div
          onMouseDown={onResizerMouseDown}
          className="w-2 mx-1 flex-shrink-0 flex items-center justify-center cursor-col-resize group"
        >
          <div className="w-1 h-16 rounded-full bg-gray-600 group-hover:bg-blue-500 transition-colors" />
        </div>
      )}

      {/* ── Right: pending posts panel ───────────────────────────────────── */}
      {selected && (
        <div
          style={{ width: panelWidth, minWidth: 280 }}
          className="flex-shrink-0 bg-[#161b22] border border-gray-800 rounded-lg flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-white font-semibold truncate">{selected.name}</h3>
            <p className="text-gray-500 text-xs mt-0.5">{posts.length} pending</p>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-2">
            {loadingPosts && <Spinner />}
            {!loadingPosts && posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onSend={() => handleSendPost(post.id)}
                onDelete={() => handleDeletePost(post.id)}
              />
            ))}
            {!loadingPosts && posts.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-8">No pending posts</p>
            )}
          </div>

          <div className="p-3 border-t border-gray-800 space-y-2">
            <button
              onClick={handleSendAllPosts}
              disabled={posts.length === 0}
              className="btn-primary w-full text-sm py-2 disabled:opacity-40"
            >
              Send All ({posts.length})
            </button>
            <button
              onClick={() => handleClear(selected.id)}
              className="btn-ghost w-full text-sm py-2"
            >
              Delete All
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

function PostCard({ post, onSend, onDelete }) {
  const imgs = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
  const time = post.scrapedAt
    ? new Date(post.scrapedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="rounded-2xl overflow-hidden bg-[#1e2c3a] mb-1">
      {/* Image */}
      {imgs[0] && (
        <img
          src={imgs[0]}
          alt=""
          className="w-full object-cover block"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      {/* Text + time */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[#e8e8e8] text-sm leading-relaxed whitespace-pre-wrap break-words">
          {post.content || ''}
        </p>
        <div className="flex justify-end mt-1">
          <span className="text-[#7a9bb5] text-xs">{time}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 px-2 pb-2 pt-1">
        <button onClick={onSend}   className="btn-primary flex-1 text-xs py-1.5">Send</button>
        <button onClick={onDelete} className="flex-1 text-xs py-1.5 rounded bg-[#2a3a4a] text-red-400 hover:text-red-300 transition-colors">Delete</button>
      </div>
    </div>
  );
}
