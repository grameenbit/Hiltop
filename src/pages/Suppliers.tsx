import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Supplier } from '../lib/db';
import { Plus, ArrowLeft, X, Truck, Loader2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { getCachedData, setCachedData, executeOrEnqueue } from '../lib/sync';
import { useAuth } from '../App';
import ConfirmModal from '../components/ConfirmModal';

export default function Suppliers() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuppliers();
    const handleSync = () => fetchSuppliers();
    window.addEventListener('sync_completed', handleSync);
    window.addEventListener('online', handleSync);
    return () => {
      window.removeEventListener('sync_completed', handleSync);
      window.removeEventListener('online', handleSync);
    };
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('outstanding', { ascending: false });
      
      if (error) {
        if (!navigator.onLine || error.message.includes('fetch')) throw new Error('Offline');
        throw error;
      }
      setSuppliers(data || []);
      setCachedData('suppliers', data);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setSuppliers(getCachedData('suppliers'));
    } finally {
      setLoading(false);
    }
  };

  const sortedSuppliers = suppliers;

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isAddDueOpen, setIsAddDueOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialDue, setInitialDue] = useState('');
  
  const [payAmount, setPayAmount] = useState('');
  const [dueAmount, setDueAmount] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});

  const openEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setName(supplier.name);
    setPhone(supplier.phone);
    setInitialDue(supplier.outstanding.toString());
    setIsEditOpen(true);
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name && phone) {
      try {
        const payload: any = {
          name,
          phone,
          outstanding: parseFloat(initialDue) || 0,
          business_id: 'temp-id'
        };

        if (isEditOpen && selectedSupplier && selectedSupplier.id) {
          await executeOrEnqueue(
            { type: 'update', table: 'suppliers', payload, match: { id: selectedSupplier.id } },
            () => {
              const updated = suppliers.map(s => s.id === selectedSupplier.id ? { ...s, ...payload } : s);
              setSuppliers(updated);
              setCachedData('suppliers', updated);
            },
            fetchSuppliers
          );
        } else {
          payload.id = crypto.randomUUID();
          await executeOrEnqueue(
            { type: 'insert', table: 'suppliers', payload },
            () => {
              const updated = [{ ...payload } as Supplier, ...suppliers];
              setSuppliers(updated);
              setCachedData('suppliers', updated);
            },
            fetchSuppliers
          );
        }
        
        setIsAddOpen(false);
        setIsEditOpen(false);
        setName('');
        setPhone('');
        setInitialDue('');
      } catch (err) {
        console.error('Failed to add supplier:', err);
      }
    }
  };

  const handlePayDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || !selectedSupplier) return;
    
    const amount = parseFloat(payAmount);
    if (amount > selectedSupplier.outstanding) {
      alert("Payment exceeds outstanding balance.");
      return;
    }

    try {
      const newOutstanding = selectedSupplier.outstanding - amount;
      await executeOrEnqueue(
        { type: 'update', table: 'suppliers', payload: { outstanding: newOutstanding }, match: { id: selectedSupplier.id } },
        () => {
          const updated = suppliers.map(s => s.id === selectedSupplier.id ? { ...s, outstanding: newOutstanding } : s);
          setSuppliers(updated);
          setCachedData('suppliers', updated);
        },
        fetchSuppliers
      );

      setIsPayOpen(false);
      setPayAmount('');
    } catch (err) {
      console.error('Failed to update supplier:', err);
    }
  };

  const handleAddDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueAmount || !selectedSupplier) return;

    try {
      const newOutstanding = selectedSupplier.outstanding + parseFloat(dueAmount);
      await executeOrEnqueue(
        { type: 'update', table: 'suppliers', payload: { outstanding: newOutstanding }, match: { id: selectedSupplier.id } },
        () => {
          const updated = suppliers.map(s => s.id === selectedSupplier.id ? { ...s, outstanding: newOutstanding } : s);
          setSuppliers(updated);
          setCachedData('suppliers', updated);
        },
        fetchSuppliers
      );

      setIsAddDueOpen(false);
      setDueAmount('');
    } catch (err) {
      console.error('Failed to update supplier:', err);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      if (typeof id === 'string' && id.startsWith('temp-')) {
        const updated = suppliers.filter(s => s.id !== id);
        setSuppliers(updated);
        setCachedData('suppliers', updated);
        return;
      }
      await executeOrEnqueue(
        { type: 'delete', table: 'suppliers', payload: {}, match: { id } },
        () => {
          const updated = suppliers.filter(s => s.id !== id);
          setSuppliers(updated);
          setCachedData('suppliers', updated);
        },
        fetchSuppliers
      );
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/more" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Suppliers</h2>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="bg-[#1aaa55] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 active:scale-95 transition-all shadow-sm"
        >
          <Plus size={18} />
          Add Supplier
        </button>
      </div>

      <div className="space-y-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
             <Loader2 className="animate-spin text-[#1aaa55]" size={32} />
          </div>
        ) : sortedSuppliers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100 italic text-gray-400">
            <Truck size={40} className="mx-auto mb-3 text-gray-200" />
            No suppliers found.
          </div>
        ) : (
          sortedSuppliers.map((supplier) => (
            <div key={supplier.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
              {supplier.outstanding > 0 && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400 opacity-20 group-hover:opacity-100 transition-opacity"></div>}
              
                <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-gray-900">{supplier.name}</h3>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(supplier)} className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-blue-500 transition-colors">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
                      </button>
                      <button onClick={() => setDeleteConfirm({isOpen: true, id: supplier.id!})} className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Active</div>
              </div>
              <p className="text-xs font-medium text-gray-400 mb-4">{supplier.phone}</p>
              
              <div className="flex justify-between items-end border-t border-gray-50 pt-4">
                <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Outstanding Balance</p>
                   <p className="font-bold text-2xl text-red-600">
                     <span className="text-base text-red-300 font-normal mr-1">৳</span>
                     {supplier.outstanding.toLocaleString()}
                   </p>
                </div>
                
                <div className="flex gap-2">
                   <button 
                    onClick={() => { setSelectedSupplier(supplier); setIsAddDueOpen(true); }}
                    className="bg-gray-50 text-gray-600 text-xs font-bold px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Add Due
                  </button>
                  <button 
                    onClick={() => { setSelectedSupplier(supplier); setIsPayOpen(true); }}
                    disabled={supplier.outstanding <= 0}
                    className="text-[#1aaa55] text-sm font-bold hover:underline mb-1 disabled:opacity-30"
                  >
                    Pay Due
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Supplier Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center border-b border-gray-100">
              <h2 className="text-xl font-bold">{isEditOpen ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Supplier Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Phone Number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">{isEditOpen ? 'Outstanding Due' : 'Initial Outstanding Due (Optional)'}</label>
                <input type="number" value={initialDue} onChange={e => setInitialDue(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55]" placeholder="0" />
              </div>
              <button type="submit" className="w-full bg-[#1aaa55] text-white font-bold py-3.5 rounded-xl hover:bg-green-600 transition-all">{isEditOpen ? 'Save Changes' : 'Add Supplier'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Pay Due Modal */}
      {isPayOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center border-b border-gray-100">
              <h2 className="text-xl font-bold">Payment to Supplier</h2>
              <button onClick={() => setIsPayOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500"><X size={18} /></button>
            </div>
            <form onSubmit={handlePayDue} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">{selectedSupplier.name}</p>
                <p className="text-sm font-medium">Total Outstanding: <span className="font-bold text-red-600">৳{selectedSupplier.outstanding.toLocaleString()}</span></p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Amount Paid *</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} required className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] text-lg font-bold" placeholder="0" />
              </div>
              <button type="submit" className="w-full bg-[#1aaa55] text-white font-bold py-3.5 rounded-xl hover:bg-green-600 transition-all">Confirm Payment</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Due Modal */}
      {isAddDueOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center border-b border-gray-100">
              <h2 className="text-xl font-bold">Record New Purchase</h2>
              <button onClick={() => setIsAddDueOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddDue} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">{selectedSupplier.name}</p>
                <p className="text-sm font-medium italic">Record goods bought on credit</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Due Amount *</label>
                <input type="number" value={dueAmount} onChange={e => setDueAmount(e.target.value)} required className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] text-lg font-bold" placeholder="0" />
              </div>
              <button type="submit" className="w-full bg-red-500 text-white font-bold py-3.5 rounded-xl hover:bg-red-600 transition-all">Add to Outstanding</button>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        onConfirm={() => {
          if (deleteConfirm.id) handleDeleteSupplier(deleteConfirm.id);
        }}
        onCancel={() => setDeleteConfirm({isOpen: false, id: null})}
      />
    </div>
  );
}
