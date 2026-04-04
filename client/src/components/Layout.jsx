import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCall } from '../contexts/CallContext';
import { Phone, LayoutDashboard, Megaphone, LogOut, Wifi, WifiOff, User } from 'lucide-react';

export default function Layout({ children }) {
  const { profile, signOut } = useAuth();
  const { connectionStatus } = useCall();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 bg-calljet-950 text-white flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-calljet-800">
          <div className="w-8 h-8 bg-calljet-500 rounded-lg flex items-center justify-center">
            <Phone className="w-4 h-4" />
          </div>
          <span className="ml-3 font-bold text-lg hidden lg:block">CallJet</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-calljet-700 text-white'
                    : 'text-calljet-300 hover:bg-calljet-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="ml-3 text-sm hidden lg:block">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Connection status */}
        <div className="px-4 py-2 border-t border-calljet-800">
          <div className="flex items-center text-xs">
            {connectionStatus === 'connected' ? (
              <><Wifi className="w-3.5 h-3.5 text-green-400 mr-2" /><span className="text-green-400 hidden lg:inline">Connected</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-red-400 mr-2" /><span className="text-red-400 hidden lg:inline">Disconnected</span></>
            )}
          </div>
        </div>

        {/* User */}
        <div className="p-3 border-t border-calljet-800">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-calljet-700 rounded-full flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="ml-3 hidden lg:block flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.display_name || profile?.name}</p>
              <p className="text-xs text-calljet-400 truncate">{profile?.role}</p>
            </div>
            <button onClick={handleSignOut} className="ml-auto text-calljet-400 hover:text-white hidden lg:block" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
