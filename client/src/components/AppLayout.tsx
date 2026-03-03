import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from './NotificationBell';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            <div className="flex items-center gap-3">
              <NotificationBell />
              {user?.role === 'superadmin' && (
                <Link to="/superadmin" className="text-xs font-semibold px-2 py-1 bg-red-100 text-red-700 rounded">
                  Admin
                </Link>
              )}
              <span className="hidden sm:block text-sm text-gray-600 max-w-[160px] truncate">{user?.email}</span>
              <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-600 transition-colors whitespace-nowrap">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
