import React, { createContext, useContext, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Home, ShoppingCart, Users, Settings, WifiOff } from 'lucide-react';
import { supabase } from './lib/supabase';
import { processSyncQueue, saveSessionToken } from './lib/sync';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import MoreOptions from './pages/MoreOptions';
import Suppliers from './pages/Suppliers';
import Employees from './pages/Employees';
import Profile from './pages/Profile';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import AdminUsers from './pages/AdminUsers';
import Stock from './pages/Stock';

// --- Contexts ---
const AuthContext = createContext<{ 
  user: any; 
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}>({ 
  user: null, 
  loading: true,
  isAdmin: false,
  signOut: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.access_token) saveSessionToken(session.access_token);
      setLoading(false);
      processSyncQueue();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.access_token) saveSessionToken(session.access_token);
      setLoading(false);
      processSyncQueue();
    });

    const handleOnline = () => {
      processSyncQueue();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const isAdmin = user?.email === 'jackmytake@gmail.com';
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Layouts & Components ---

function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => { 
      setIsOnline(true);
      processSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also process sync queue on first load if we are online and logged in
    if (navigator.onLine) {
       processSyncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-red-500 text-white text-xs py-1 px-4 text-center flex items-center justify-center gap-2 sticky top-0 z-[100]">
      <WifiOff size={14} />
      <span>You are offline. Working in offline mode.</span>
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', icon: Home, label: isAdmin ? 'Dashboard' : 'Home', path: '/' },
    { id: 'sales', icon: ShoppingCart, label: 'Sales', path: '/sales' },
    { id: 'customers', icon: Users, label: 'Customers', path: '/customers' },
    { id: 'more', icon: Settings, label: 'More', path: '/more' },
  ];

  const showNav = navItems.some(item => item.path === location.pathname);
  if (!showNav) return null;

  return (
    <div className="fixed bottom-0 w-full max-w-lg bg-white/80 backdrop-blur-xl border-t border-gray-100 flex justify-between p-2 pb-safe px-6 z-50">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.id}
            to={item.path}
            className={`flex flex-col items-center p-2 rounded-2xl transition-all duration-300 ${
              isActive ? 'text-[#1aaa55]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`p-1.5 rounded-xl mb-1 transition-all duration-300 ${isActive ? 'bg-[#1aaa55]/10 scale-110 shadow-sm' : 'bg-transparent'}`}>
              <item.icon size={22} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
            </div>
            <span className={`text-[10px] transition-all duration-300 ${isActive ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto shadow-2xl relative flex flex-col">
      <SyncStatus />
      
      <div className="bg-gradient-to-br from-[#1aaa55] to-[#128a45] text-white pt-10 pb-6 px-5 sticky top-0 z-40 shadow-[0_4px_12px_rgba(26,170,85,0.2)] border-b border-white/10 rounded-b-[32px]">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight drop-shadow-sm">Alif Garments</h1>
            <p className="text-white/70 text-[11px] font-bold uppercase tracking-[2px] mt-0.5">{isAdmin ? 'Admin Portal' : 'Staff Dashboard'}</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-right text-[10px] opacity-80 hidden sm:block font-bold uppercase tracking-wider">
               <p>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
               <p>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
             </div>

             <button 
               onClick={() => supabase.auth.signOut()}
               className="w-10 h-10 bg-white/20 hover:bg-white/30 transition-colors rounded-full flex items-center justify-center backdrop-blur-md"
               title="Sign out"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
             </button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}

function AppContent() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#1aaa55] font-bold">Loading...</div>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={isAdmin ? <AdminPanel /> : <Dashboard />} />
        <Route path="/admin" element={isAdmin ? <AdminPanel /> : <Navigate to="/" />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/more" element={<MoreOptions />} />
        {/* Only admin can manage suppliers and employees */}
        <Route path="/suppliers" element={isAdmin ? <Suppliers /> : <Navigate to="/" />} />
        <Route path="/employees" element={isAdmin ? <Employees /> : <Navigate to="/" />} />
        <Route path="/admin-users" element={isAdmin ? <AdminUsers /> : <Navigate to="/" />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
}
