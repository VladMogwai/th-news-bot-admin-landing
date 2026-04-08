import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard'  },
  { to: '/sources',    label: 'Sources'    },
  { to: '/authority',  label: 'Authority'  },
  { to: '/settings',   label: 'Settings'   },
];

export default function Sidebar() {
  const { logout, username } = useAuth();

  return (
    <aside className="w-56 flex-shrink-0 bg-[#161b22] flex flex-col border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-white font-semibold text-base">TG News Bot</h1>
        {username && <p className="text-gray-500 text-xs mt-0.5">{username}</p>}
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-[#2563eb] text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-gray-800">
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
