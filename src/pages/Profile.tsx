import { useState, useEffect } from 'react';
import { ArrowLeft, LogOut, Copy, Check, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { Employee } from '../lib/db';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Partial<Employee> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single();
    
    if (data) setProfile(data);
  };

  const copyToClipboard = () => {
    if (profile?.username) {
      navigator.clipboard.writeText(profile.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/more" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-xl font-bold">Account Settings</h2>
      </div>

      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-6">
        <div className="w-24 h-24 bg-[#1aaa55]/10 text-[#1aaa55] rounded-full flex items-center justify-center text-3xl font-black border-4 border-white shadow-inner">
          {profile?.display_name ? profile.display_name[0].toUpperCase() : <User size={40} />}
        </div>
        
        <div className="text-center w-full">
          <h3 className="text-2xl font-black text-gray-900">{profile?.display_name || 'Loading...'}</h3>
          <p className="text-gray-400 font-medium">{user?.email}</p>
          
          <div className="mt-6 flex justify-center">
            <button 
              onClick={copyToClipboard}
              className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl flex items-center gap-3 hover:bg-gray-100 transition-colors group relative active:scale-95"
            >
              <span className="text-lg font-bold text-[#1aaa55]">{profile?.username || '@username'}</span>
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-100 text-gray-400 group-hover:text-[#1aaa55] transition-colors">
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </div>
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                {copied ? 'Copied!' : 'Copy Username'}
              </span>
            </button>
          </div>
        </div>

        <div className="w-full pt-4 space-y-3">
          <div className="flex justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Position</span>
            <span className="text-gray-900 font-bold">{profile?.position || 'Sales Staff'}</span>
          </div>
          <div className="flex justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Role</span>
            <span className="text-green-600 font-black uppercase text-xs tracking-widest">{profile?.role}</span>
          </div>
        </div>
      </div>

      <button 
        onClick={signOut}
        className="w-full bg-red-50 text-red-600 font-bold py-5 rounded-[24px] flex items-center justify-center gap-2 active:scale-95 transition-transform border border-red-100"
      >
        <LogOut size={20} />
        Sign Out
      </button>
    </div>
  );
}
