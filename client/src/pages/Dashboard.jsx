import { useEffect, useState } from 'react';
import api from '../api/axios';
import Spinner from '../components/Spinner';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/stats/dashboard')
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load dashboard'));
  }, []);

  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return <Spinner />;

  return (
    <div>
      <h2 className="text-white text-xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 gap-4 mb-8 max-w-md">
        <StatCard label="Posts scraped today" value={data.scrapedToday} />
        <StatCard label="Posts sent today"    value={data.sentToday}    />
      </div>

      <h3 className="text-white font-semibold mb-3">Recent Logs</h3>
      <div className="bg-[#161b22] border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3 whitespace-nowrap">Time</th>
            </tr>
          </thead>
          <tbody>
            {data.recentLogs.map((log) => (
              <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                  {log.source?.name || '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={log.status} />
                </td>
                <td className="px-4 py-3 text-gray-400 max-w-sm truncate">{log.message}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {data.recentLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-600">
                  No logs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-lg p-5">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-white text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const isError = status === 'error';
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${
      isError ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'
    }`}>
      {status || '—'}
    </span>
  );
}
