import { ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from './NotificationBell';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/dashboard" className="text-xl font-bold text-brand-700">🌳 Family Tree</Link>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-3">
              <NotificationBell />
              {user?.role === 'superadmin' && (
                <Link to="/superadmin" className="text-xs font-semibold px-2 py-1 bg-red-100 text-red-700 rounded">
                  Super Admin
                </Link>
              )}
              <span className="text-sm text-gray-600 max-w-[160px] truncate">{user?.email}</span>
              <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-600 transition-colors whitespace-nowrap">
                Logout
              </button>
            </div>

            {/* Mobile: bell + hamburger */}
            <div className="flex sm:hidden items-center gap-2">
              <NotificationBell />
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                {menuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile dropdown menu */}
          {menuOpen && (
            <div className="sm:hidden border-t border-gray-100 py-3 space-y-1">
              <p className="text-xs text-gray-400 px-3 pb-1 truncate">{user?.email}</p>
              {user?.role === 'superadmin' && (
                <Link to="/superadmin" onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-semibold text-red-700 bg-red-50 rounded-lg">
                  Super Admin Dashboard
                </Link>
              )}
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                Dashboard
              </Link>
              <button onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
