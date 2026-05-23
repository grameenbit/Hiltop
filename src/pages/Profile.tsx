import React, { useState, useEffect } from 'react';
import { ArrowLeft, LogOut, Copy, Check, User, Save, Lock, Edit3, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { Employee } from '../lib/db';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Partial<Employee> | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Update state variables
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password state variables
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

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
    
    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
      setUsername(data.username || '');
    }
  };

  const copyToClipboard = () => {
    if (profile?.username) {
      navigator.clipboard.writeText(profile.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess(null);
    setProfileError(null);

    let formattedUsername = username.trim();
    if (!formattedUsername) {
      setProfileError('ইউজারনেম খালি রাখা যাবে না!');
      setProfileLoading(false);
      return;
    }

    if (!formattedUsername.startsWith('@')) {
      formattedUsername = '@' + formattedUsername;
      setUsername(formattedUsername);
    }

    try {
      // Check if username is already taken by another user
      const { data: duplicateUser, error: dupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', formattedUsername)
        .neq('id', user?.id);

      if (duplicateUser && duplicateUser.length > 0) {
        setProfileError('এই ইউজারনেমটি ইতিমধ্যে অন্য কোনো ব্যবহারকারী নিয়েছেন! অনুগ্রহ করে ভিন্ন ইউজারনেম টাইপ করুন।');
        setProfileLoading(false);
        return;
      }

      // Update in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username: formattedUsername
        })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setProfileSuccess('প্রোফাইল তথ্য সফলভাবে পরিবর্তন করা হয়েছে!');
      
      // Update local profile state
      if (profile) {
        setProfile({
          ...profile,
          display_name: displayName.trim(),
          username: formattedUsername
        });
      }
    } catch (err: any) {
      setProfileError(err.message || 'প্রোফাইল পরিবর্তন করতে সমস্যা হয়েছে!');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwSuccess(null);
    setPwError(null);

    if (!newPassword) {
      setPwError('নতুন পাসওয়ার্ড টাইপ করুন!');
      setPwLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setPwError('পাসওয়ার্ডটি অবশ্যই কমপক্ষে ৬ অক্ষরের হতে হবে!');
      setPwLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('রিটাইপ করা পাসওয়ার্ডটি মেলেনি! আবার চেষ্টা করুন।');
      setPwLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPwSuccess('পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে!');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Back Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/more" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-xl font-bold">প্রোফাইল সেটিংস (Profile)</h2>
      </div>

      {/* Main Avatar Card */}
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

      {/* Profile Modification Form */}
      <form onSubmit={handleUpdateProfile} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
        <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider border-b border-gray-50 pb-3 flex items-center gap-2">
          <Edit3 size={16} className="text-[#1aaa55]" />
          নাম ও ইউজারনেম পরিবর্তন
        </h4>

        {profileSuccess && (
          <div className="p-4 bg-green-50 border border-green-100 text-green-700 text-xs font-bold rounded-2xl">
            {profileSuccess}
          </div>
        )}

        {profileError && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-2xl">
            {profileError}
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Display Name</label>
          <input 
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 font-bold text-sm"
            placeholder="আপনার নাম"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Username (অবশ্যই @ থাকতে হবে)</label>
          <input 
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 font-bold text-sm"
            placeholder="@username"
          />
        </div>

        <button
          type="submit"
          disabled={profileLoading}
          className="w-full bg-[#1aaa55] hover:bg-green-600 disabled:bg-gray-200 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {profileLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={18} />}
          সংরক্ষণ করুন (Save Changes)
        </button>
      </form>

      {/* Password Changer Form */}
      <form onSubmit={handleUpdatePassword} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-4">
        <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider border-b border-gray-50 pb-3 flex items-center gap-2">
          <Lock size={16} className="text-[#1aaa55]" />
          পাসওয়ার্ড পরিবর্তন করুন
        </h4>

        {pwSuccess && (
          <div className="p-4 bg-green-50 border border-green-100 text-green-700 text-xs font-bold rounded-2xl">
            {pwSuccess}
          </div>
        )}

        {pwError && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-2xl">
            {pwError}
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">New Password (পাসওয়ার্ড)</label>
          <input 
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 font-semibold text-sm"
            placeholder="কমপক্ষে ৬ সংখ্যার গোপন পাসওয়ার্ড"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Retype Password (পুনরায় পাসওয়ার্ড)</label>
          <input 
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 font-semibold text-sm"
            placeholder="পাসওয়ার্ডটি পুনরায় টাইপ করুন"
          />
        </div>

        <button
          type="submit"
          disabled={pwLoading}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-gray-200 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {pwLoading ? <Loader2 size={20} className="animate-spin" /> : <Check size={18} />}
          পাসওয়ার্ড আপডেট করুন
        </button>
      </form>

      {/* Logout button */}
      <button 
        onClick={signOut}
        className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-5 rounded-[24px] flex items-center justify-center gap-2 active:scale-95 transition-transform border border-red-100 shadow-sm"
      >
        <LogOut size={20} />
        Log Out (লগ আউট করুন)
      </button>
    </div>
  );
}
