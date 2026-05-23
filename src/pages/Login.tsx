import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Store } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (isSignUp && !username.startsWith('@')) {
      setError('Username must start with @');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // 1. Check for duplicate emails in profiles table
        const { data: existingEmailUser, error: checkEmailError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email.trim().toLowerCase());
        
        if (existingEmailUser && existingEmailUser.length > 0) {
          setError('এই ইমেইল দিয়ে ইতঃপূর্বে অ্যাকাউন্ট খোলা হয়েছে! দয়া করে অন্য ইমেইল ব্যবহার করুন।');
          setLoading(false);
          return;
        }

        // 2. Check for duplicate usernames
        const { data: existingUsernameUser, error: checkUserError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.trim());
          
        if (existingUsernameUser && existingUsernameUser.length > 0) {
          setError('এই ইউজারনেম দিয়ে ইতঃপূর্বে অ্যাকাউন্ট খোলা হয়েছে! দয়া করে অন্য ইউজারনেম ব্যবহার করুন।');
          setLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email, 
          password,
        });
        
        if (authError) throw authError;

        if (authData.user) {
          const isSuperAdmin = email.trim().toLowerCase() === 'jackmytake@gmail.com';
          const defaultStatus = isSuperAdmin ? 'approved' : 'pending';
          const defaultRole = isSuperAdmin ? 'admin' : 'staff';

          const { error: profileError } = await supabase.from('profiles').insert([{
            id: authData.user.id,
            username: username,
            name: displayName,
            display_name: displayName,
            email: email,
            role: defaultRole,
            status: defaultStatus,
            business_id: 'temp-id'
          }]);
          
          if (profileError) {
            console.error('Profile creation error:', profileError);
            if (profileError.message.includes('display_name') || profileError.message.includes('username')) {
              setError('Database Error: Some columns are missing in your "profiles" table. Please run the updated SQL in Supabase SQL Editor.');
            } else {
              setError(profileError.message);
            }
            setLoading(false);
            return;
          }
        }

        if (email.trim().toLowerCase() === 'jackmytake@gmail.com') {
          alert('Admin account created! You can now log in.');
        } else {
          alert('অ্যাকাউন্ট তৈরি হয়েছে! এটি এখন পেন্ডিং অবস্থায় আছে। এডমিন অনুমোদন করলে আপনি লগইন করতে পারবেন।');
        }
        setIsSignUp(false);
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (signInData?.user) {
          const isSuperAdmin = email.trim().toLowerCase() === 'jackmytake@gmail.com';
          
          const { data: userProfile, error: profileErr } = await supabase
            .from('profiles')
            .select('status, role')
            .eq('id', signInData.user.id)
            .single();

          if (userProfile && !isSuperAdmin) {
            if (userProfile.status === 'blocked') {
              await supabase.auth.signOut();
              setError('আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে! অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করুন।');
              setLoading(false);
              return;
            } else if (userProfile.status === 'pending') {
              await supabase.auth.signOut();
              setError('আপনার অ্যাকাউন্টটি এখনো অনুমোদিত হয়নি! দয়া করে এডমিন দ্বারা অনুমোদিত হওয়া পর্যন্ত অপেক্ষা করুন।');
              setLoading(false);
              return;
            }
          }
        }
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch') || errMsg.includes('Network') || errMsg.includes('TypeError')) {
        setError('নেটওয়ার্ক সংযোগ নেই! অনুগ্রহ করে ইন্টারনেট বা ডাটা কানেকশন চালু করুন।');
      } else if (errMsg.includes('Invalid login credentials')) {
        setError('ভুল ইমেইল অথবা পাসওয়ার্ড! আবার চেষ্টা করুন।');
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 py-12">
      <div className="w-full max-w-sm space-y-8 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto mb-4 overflow-hidden rounded-2xl shadow-lg ring-4 ring-[#1aaa55]/10">
            <img 
              src="/src/assets/images/alif_garments_icon.png" 
              alt="Alif Garments App Icon" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
            />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Alif Garments</h1>
          <p className="text-gray-500 font-medium text-sm">Efficient shop management starts here</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm font-medium rounded-xl">{error}</div>}
          
          {isSignUp && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Username (must start with @)</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
                  placeholder="@john_doe"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
              placeholder="user@shop.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
              placeholder="••••••••"
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1aaa55] text-white font-bold py-4 rounded-xl hover:bg-green-600 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 mt-2"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In to Dashboard'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 font-medium">
          {isSignUp ? 'Already joined?' : "New to Alif Garments?"}{' '}
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-[#1aaa55] font-bold hover:underline ml-1">
            {isSignUp ? 'Sign In instead' : 'Create an account'}
          </button>
        </p>
      </div>
    </div>
  );
}
