import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../lib/db';
import { ArrowLeft, User, Shield, Briefcase, DollarSign, Save, Loader2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { executeOrEnqueue, getCachedData, setCachedData } from '../lib/sync';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminUsers() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="animate-spin text-[#1aaa55]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#f8fafc] min-h-screen pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 italic">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Registered Shops & Staff</p>
        </div>
      </div>

      <div className="space-y-4">
        {employees.map((emp) => (
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
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-[#1aaa55] font-black text-xl border border-gray-100 shadow-inner">
                  {emp.display_name ? emp.display_name[0].toUpperCase() : 'U'}
                </div>
                <div className="flex-1">
                   <h3 className="font-black text-lg text-gray-900">{emp.display_name}</h3>
                   <div className="flex flex-col">
                     <p className="text-sm font-bold text-[#1aaa55]">{emp.username}</p>
                     <p className="text-[10px] font-medium text-gray-400">{emp.email}</p>
                   </div>
                </div>
                <button onClick={() => setDeleteConfirm({isOpen: true, id: emp.id!})} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
             </div>

             {editingId === emp.id ? (
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
                   <div className="col-span-2">
                      <button 
                        onClick={() => handleEdit(emp)}
                        className="w-full mt-2 py-3 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50 transition-all active:scale-[0.98]"
                      >
                        Edit Roles & Access
                      </button>
                   </div>
                </div>
             )}
          </div>
        ))}
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
