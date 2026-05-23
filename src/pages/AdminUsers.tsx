import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../lib/db';
import { ArrowLeft, User, Shield, Briefcase, DollarSign, Save, Loader2, Trash2, Check, Ban, X, UserX, UserCheck, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { executeOrEnqueue, getCachedData, setCachedData } from '../lib/sync';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminUsers() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
  const [activeTab, setActiveTab] = useState<'approved' | 'pending' | 'blocked'>('approved');
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});

  useEffect(() => {
    fetchUsers();
    const handleSync = () => fetchUsers();
    window.addEventListener('sync_completed', handleSync);
    window.addEventListener('online', handleSync);
    return () => {
      window.removeEventListener('sync_completed', handleSync);
      window.removeEventListener('online', handleSync);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        if (!navigator.onLine || error.message.includes('fetch')) throw new Error('Offline');
        throw error;
      }
      setEmployees(data || []);
      setCachedData('profiles', data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setEmployees(getCachedData('profiles'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id || null);
    setEditForm(emp);
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await executeOrEnqueue(
        { type: 'delete', table: 'profiles', payload: {}, match: { id } },
        () => {
          const updated = employees.filter(e => e.id !== id);
          setEmployees(updated);
          setCachedData('profiles', updated);
        },
        fetchUsers
      );
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete employee');
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      const updates = {
        role: editForm.role,
        position: editForm.position,
        salary: editForm.salary,
        commission_rate: editForm.commission_rate
      };
      await executeOrEnqueue(
        { type: 'update', table: 'profiles', payload: updates, match: { id: editingId } },
        () => {
          const updated = employees.map(e => e.id === editingId ? { ...e, ...updates } : e);
          setEmployees(updated);
          setCachedData('profiles', updated);
        },
        fetchUsers
      );
      setEditingId(null);
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update user');
    }
  };

  const handleSetStatus = async (id: string, newStatus: string) => {
    try {
      const updates = { status: newStatus };
      await executeOrEnqueue(
        { type: 'update', table: 'profiles', payload: updates, match: { id } },
        () => {
          const updated = employees.map(e => e.id === id ? { ...e, status: newStatus } : e);
          setEmployees(updated);
          setCachedData('profiles', updated);
        },
        fetchUsers
      );
    } catch (err) {
      console.error('Update status error:', err);
      alert('স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে!');
    }
  };

  const handleReject = async (id: string) => {
    if (confirm('আপনি কি নিশ্চিত যে আপনি এই রেজিস্ট্রেশন আবেদনটি বাতিল করতে চান?')) {
      try {
        await executeOrEnqueue(
          { type: 'delete', table: 'profiles', payload: {}, match: { id } },
          () => {
            const updated = employees.filter(e => e.id !== id);
            setEmployees(updated);
            setCachedData('profiles', updated);
          },
          fetchUsers
        );
      } catch (err) {
        console.error('Reject error:', err);
        alert('আবেদনটি বাতিল করা ব্যর্থ হয়েছে!');
      }
    }
  };

  // Grouping logic with status fallbacks
  const getGroupedEmployees = () => {
    return employees.filter(emp => {
      const status = emp.status || 'approved'; // default is approved for backward compatibility
      if (activeTab === 'approved') return status === 'approved';
      if (activeTab === 'pending') return status === 'pending';
      if (activeTab === 'blocked') return status === 'blocked';
      return false;
    });
  };

  const groupCounts = {
    approved: employees.filter(e => (e.status || 'approved') === 'approved').length,
    pending: employees.filter(e => e.status === 'pending').length,
    blocked: employees.filter(e => e.status === 'blocked').length,
  };

  const filteredList = getGroupedEmployees();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="animate-spin text-[#1aaa55]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#f8fafc] min-h-screen pb-24">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900">ব্যবহারকারী ও কর্মী নিয়ন্ত্রণ Panel</h2>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Employee & Approval System</p>
        </div>
      </div>

      {/* Segmented Category Control Tabs */}
      <div className="bg-white p-1 rounded-2xl flex gap-1 border border-gray-100 shadow-sm mb-6">
        <button
          onClick={() => setActiveTab('approved')}
          className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all duration-300 ${
            activeTab === 'approved'
              ? 'bg-[#1aaa55] text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          সক্রিয় কর্মী ({groupCounts.approved})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all duration-300 relative ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          আবেদন ({groupCounts.pending})
          {groupCounts.pending > 0 && (
            <span className="absolute -top-1.5 -right-1 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#f8fafc] animate-bounce">
              {groupCounts.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('blocked')}
          className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all duration-300 ${
            activeTab === 'blocked'
              ? 'bg-red-500 text-white shadow-md'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          ব্লকড ({groupCounts.blocked})
        </button>
      </div>

      {/* Rendered List */}
      <div className="space-y-4">
        {filteredList.length === 0 ? (
          <div className="bg-white p-12 rounded-[28px] text-center border border-dashed border-gray-200">
            <AlertCircle size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-bold">এই ক্যাটাগরিতে কোনো অ্যাকাউন্ট পাওয়া যায়নি!</p>
            <p className="text-xs text-gray-400 mt-1">সবকিছু আপ-টু-ডেট রয়েছে।</p>
          </div>
        ) : (
          filteredList.map((emp) => (
            <div key={emp.id} className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100 overflow-hidden relative group">
               {emp.role === 'admin' ? (
                  <div className="absolute top-0 right-0 bg-[#1aaa55] text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest shadow-sm">
                    Super User
                  </div>
               ) : (
                  <div className="absolute top-0 right-0 bg-gray-100 text-gray-500 text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest">
                    {emp.role}
                  </div>
               )}

               <div className="flex items-center gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border shadow-inner ${
                    activeTab === 'pending' 
                      ? 'bg-amber-50 text-amber-500 border-amber-100' 
                      : activeTab === 'blocked'
                        ? 'bg-red-50 text-red-500 border-red-100'
                        : 'bg-green-50 text-[#1aaa55] border-green-100'
                  }`}>
                    {emp.display_name ? emp.display_name[0].toUpperCase() : 'U'}
                  </div>
                  <div className="flex-1">
                     <h3 className="font-black text-lg text-gray-900">{emp.display_name}</h3>
                     <div className="flex flex-col">
                       <p className="text-sm font-bold text-[#1aaa55]">{emp.username}</p>
                       <p className="text-[10px] font-medium text-gray-400">{emp.email}</p>
                     </div>
                  </div>
                  {/* Delete Button (Can delete any non-super admin staff) */}
                  {emp.email !== 'jackmytake@gmail.com' && (
                    <button 
                      onClick={() => setDeleteConfirm({isOpen: true, id: emp.id!})} 
                      className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                      title="স্থায়ীভাবে ডিলিট করুন"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
               </div>

               {/* PENDING APPROVAL CONTROLS */}
               {activeTab === 'pending' && (
                 <div className="grid grid-cols-2 gap-3 mt-4">
                   <button
                     onClick={() => handleSetStatus(emp.id!, 'approved')}
                     className="bg-[#1aaa55] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 active:scale-95 transition-all shadow-sm border border-transparent"
                   >
                     <UserCheck size={18} />
                     Approve
                   </button>
                   <button
                     onClick={() => handleReject(emp.id!)}
                     className="bg-red-50 text-red-600 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 active:scale-95 transition-all border border-red-100"
                   >
                     <UserX size={18} />
                     Reject
                   </button>
                 </div>
               )}

               {/* BLOCKED ACCOUNT CONTROLS */}
               {activeTab === 'blocked' && (
                 <div className="mt-4">
                   <button
                     onClick={() => handleSetStatus(emp.id!, 'approved')}
                     className="w-full bg-[#1aaa55]/10 hover:bg-[#1aaa55]/20 text-[#1aaa55] font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-[#1aaa55]/10"
                   >
                     <UserCheck size={18} />
                     সক্রিয় ও প্রবেশাধিকার দিন (Unblock)
                   </button>
                 </div>
               )}

               {/* APPROVED ACTIVE CONTROLS */}
               {activeTab === 'approved' && (
                 editingId === emp.id ? (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">System Role</label>
                            <select 
                              value={editForm.role}
                              onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 font-bold text-sm"
                            >
                              <option value="staff">Staff Member</option>
                              <option value="admin">Admin / Owner</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Work Position</label>
                            <input 
                              type="text"
                              value={editForm.position}
                              onChange={(e) => setEditForm({...editForm, position: e.target.value})}
                              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 font-bold text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Monthly Salary (৳)</label>
                            <input 
                              type="number"
                              value={editForm.salary}
                              onChange={(e) => setEditForm({...editForm, salary: Number(e.target.value)})}
                              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 font-bold text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Comm. Rate (%)</label>
                            <input 
                              type="number"
                              value={editForm.commission_rate}
                              onChange={(e) => setEditForm({...editForm, commission_rate: Number(e.target.value)})}
                              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 font-bold text-sm"
                            />
                          </div>
                       </div>
                       <div className="flex gap-3">
                          <button 
                            onClick={handleUpdate}
                            className="flex-1 bg-[#1aaa55] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-md"
                          >
                            <Save size={18} />
                            Update Access
                          </button>
                          <button 
                            onClick={() => setEditingId(null)}
                            className="px-6 bg-gray-100 text-gray-500 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                       </div>
                    </div>
                 ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 mt-4">
                         <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Position</p>
                            <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                              <Briefcase size={14} className="text-[#1aaa55]" />
                              {emp.position || 'Salesman'}
                            </p>
                         </div>
                         <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Salary</p>
                            <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                              <DollarSign size={14} className="text-[#1aaa55]" />
                              ৳{emp.salary?.toLocaleString()}
                            </p>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                         <button 
                           onClick={() => handleEdit(emp)}
                           className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 transition-all active:scale-[0.98]"
                         >
                           Edit Roles & Salary
                         </button>
                         {emp.email !== 'jackmytake@gmail.com' && (
                           <button 
                             onClick={() => handleSetStatus(emp.id!, 'blocked')}
                             className="py-3 bg-red-50 text-red-600 border border-red-100 font-bold text-sm rounded-xl hover:bg-red-100 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                           >
                             <Ban size={14} />
                             Block করুন (সহায়তা বন্ধ)
                           </button>
                         )}
                      </div>
                    </div>
                 )
               )}
            </div>
          ))
        )}
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={() => {
          if (deleteConfirm.id) handleDeleteEmployee(deleteConfirm.id);
        }}
        onCancel={() => setDeleteConfirm({isOpen: false, id: null})}
      />
    </div>
  );
}
