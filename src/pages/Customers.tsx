import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Customer } from '../lib/db';
import { Plus, X, User as UserIcon, Loader2, Trash2 } from 'lucide-react';
import { getCachedData, setCachedData, enqueueSyncAction, executeOrEnqueue } from '../lib/sync';
import { useAuth } from '../App';
import ConfirmModal from '../components/ConfirmModal';

export default function Customers() {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
    const handleSync = () => fetchCustomers();
    window.addEventListener('sync_completed', handleSync);
    window.addEventListener('online', handleSync);
    return () => {
      window.removeEventListener('sync_completed', handleSync);
      window.removeEventListener('online', handleSync);
    };
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('balance', { ascending: false });
      
      if (error) {
        if (!navigator.onLine || error.message.includes('fetch')) {
          throw new Error('Offline');
        }
        throw error;
      };
      
      setCustomers(data || []);
      setCachedData('customers', data);
    } catch (err) {
      console.error('Error fetching customers:', err);
      const cached = getCachedData<Customer>('customers');
      setCustomers(cached);
    } finally {
      setLoading(false);
    }
  };
  
  const sortedCustomers = customers;

  // States for Modals
  const [isAddDueOpen, setIsAddDueOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form states for Add / Edit Due
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');

  // Form state for Payment
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // Form state for Adding Due to existing customer
  const [isAddDueExistingOpen, setIsAddDueExistingOpen] = useState(false);
  const [extraDueAmount, setExtraDueAmount] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address || '');
    setAmount(customer.balance.toString());
    setIsEditOpen(true);
  };

  const handleAddDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !amount) {
      alert("Name, phone, and amount are required");
      return;
    }

    try {
      const payload: any = {
        name,
        phone,
        balance: parseFloat(amount),
        business_id: 'temp-id'
      };
      
      if (address) {
        payload.address = address;
      }

      if (isEditOpen && selectedCustomer && selectedCustomer.id) {
        await executeOrEnqueue(
          { type: 'update', table: 'customers', payload, match: { id: selectedCustomer.id } },
          () => {
            const updated = customers.map(c => c.id === selectedCustomer.id ? { ...c, ...payload } : c);
            setCustomers(updated);
            setCachedData('customers', updated);
          },
          fetchCustomers
        );
      } else {
        payload.id = crypto.randomUUID();
        await executeOrEnqueue(
          { type: 'insert', table: 'customers', payload },
          () => {
            const updated = [{...payload} as Customer, ...customers];
            setCustomers(updated);
            setCachedData('customers', updated);
          },
          fetchCustomers
        );
      }

      setIsAddDueOpen(false);
      setIsEditOpen(false);
      setName(''); setPhone(''); setAddress(''); setAmount('');
    } catch (err: any) {
      console.error('Failed to save customer:', err);
      const msg = err.message || 'Unknown error';
      if (msg.includes('address') || err.code === 'PGRST204') {
        alert('Database Error: The "address" column is missing in your customers table. Please run the SQL update in Supabase.');
      } else {
        alert(`Error: ${msg}`);
      }
    }
  };

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !selectedCustomer) return;
    
    const payAmt = parseFloat(paymentAmount);
    if (payAmt > selectedCustomer.balance) {
      alert("Payment amount cannot be greater than due amount");
      return;
    }

    const newBalance = selectedCustomer.balance - payAmt;

    try {
      await executeOrEnqueue(
        { type: 'update', table: 'customers', payload: { balance: newBalance }, match: { id: selectedCustomer.id } },
        () => {
          const updated = customers.map(c => c.id === selectedCustomer.id ? { ...c, balance: newBalance } : c);
          setCustomers(updated);
          setCachedData('customers', updated);
        },
        fetchCustomers
      );

      setIsPaymentOpen(false);
      setPaymentAmount('');
    } catch (err) {
      console.error('Failed to process payment:', err);
    }
  };

  const handleAddExtraDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraDueAmount || !selectedCustomer) return;

    const newBalance = selectedCustomer.balance + parseFloat(extraDueAmount);

    try {
      await executeOrEnqueue(
        { type: 'update', table: 'customers', payload: { balance: newBalance }, match: { id: selectedCustomer.id } },
        () => {
          const updated = customers.map(c => c.id === selectedCustomer.id ? { ...c, balance: newBalance } : c);
          setCustomers(updated);
          setCachedData('customers', updated);
        },
        fetchCustomers
      );

      setIsAddDueExistingOpen(false);
      setExtraDueAmount('');
    } catch (err) {
      console.error('Failed to add extra due:', err);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await executeOrEnqueue(
        { type: 'delete', table: 'customers', payload: {}, match: { id } },
        () => {
          const updated = customers.filter(c => c.id !== id);
          setCustomers(updated);
          setCachedData('customers', updated);
        },
        fetchCustomers
      );
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customer Dues</h2>
          <p className="text-sm text-gray-500">Track and manage customer balances</p>
        </div>
        <button 
          onClick={() => setIsAddDueOpen(true)}
          className="bg-[#1aaa55] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-green-600 transition-colors"
        >
          <Plus size={18} />
          New Customer
        </button>
      </div>

      <div className="space-y-4 pb-24 relative">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#1aaa55]" size={32} />
          </div>
        ) : sortedCustomers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            <UserIcon size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No customers found.</p>
            <p className="text-sm text-gray-400 mt-1">Click New Customer to track a customer's due.</p>
          </div>
        ) : (
          sortedCustomers.map((customer) => (
            <div 
              key={customer.id} 
              className="w-full bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:border-[#1aaa55]/30 group overflow-hidden relative"
            >
              {customer.balance > 0 && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400 opacity-20 group-hover:opacity-100 transition-opacity"></div>}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-gray-900 group-hover:text-[#1aaa55] transition-colors">{customer.name}</h3>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(customer)} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-blue-500 transition-colors">
                        <span className="text-[10px] font-bold uppercase">Edit</span>
                      </button>
                      <button onClick={() => setDeleteConfirm({isOpen: true, id: customer.id!})} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-400 mt-1">{customer.phone}</p>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => { setSelectedCustomer(customer); setIsPaymentOpen(true); }}
                    className="text-[10px] font-bold bg-[#1aaa55]/10 text-[#1aaa55] px-3 py-1.5 rounded-full uppercase tracking-wider hover:bg-[#1aaa55] hover:text-white transition-all shadow-sm"
                  >
                    Pay Due
                  </button>
                  <button 
                    onClick={() => { setSelectedCustomer(customer); setIsAddDueExistingOpen(true); }}
                    className="text-[10px] font-bold bg-red-50 text-red-500 px-3 py-1.5 rounded-full uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    Add Due
                  </button>
                </div>
              </div>
              <div className="text-right">
                {customer.balance > 0 ? (
                  <>
                    <p className="text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-widest">Balance Due</p>
                    <p className="font-black text-2xl text-red-600">
                      <span className="text-sm text-red-300 font-normal mr-1">৳</span>
                      {customer.balance.toLocaleString()}
                    </p>
                  </>
                ) : (
                  <div className="bg-green-50 text-[#1aaa55] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-green-100">
                    Paid
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Due to Existing Customer Modal */}
      {isAddDueExistingOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Add Extra Due</h2>
              <button onClick={() => setIsAddDueExistingOpen(false)} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddExtraDue} className="p-6 space-y-6">
              <div className="bg-[#f8fafc] p-4 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-500 mb-1 font-medium">Customer</p>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{selectedCustomer.name}</h3>
                <p className="text-sm font-medium">Current Due: <span className="font-bold text-red-600 ml-1">৳ {selectedCustomer.balance.toLocaleString()}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Extra Due Amount *</label>
                <input
                  type="number"
                  value={extraDueAmount}
                  onChange={(e) => setExtraDueAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all font-semibold"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-red-500 text-white font-bold py-3.5 rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all shadow-sm"
              >
                Increase Due
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Receive Payment</h2>
              <button onClick={() => setIsPaymentOpen(false)} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-[#f8fafc] p-4 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-500 mb-1 font-medium">Customer</p>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{selectedCustomer.name}</h3>
                <p className="text-sm font-medium">Due: <span className="font-bold text-red-600 ml-1">৳ {selectedCustomer.balance.toLocaleString()}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
                />
              </div>

              <button 
                onClick={handleReceivePayment}
                className="w-full bg-[#1aaa55] text-white font-bold py-3.5 rounded-xl hover:bg-green-600 active:scale-[0.98] transition-all shadow-sm"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Due Modal */}
      {(isAddDueOpen || isEditOpen) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4 sm:p-0">
          <div className="bg-white w-full sm:max-w-md h-auto rounded-[24px] flex flex-col shadow-2xl relative overflow-hidden mt-auto mb-auto max-h-screen animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{isEditOpen ? 'Edit Customer' : 'Add Customer Due'}</h2>
              <button 
                onClick={() => { setIsAddDueOpen(false); setIsEditOpen(false); }} 
                className="bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddDue} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block font-medium mb-1.5 text-sm text-gray-700">Customer Name *</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Karim"
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block font-medium mb-1.5 text-sm text-gray-700">Mobile Number *</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block font-medium mb-1.5 text-sm text-gray-700">Address (Optional)</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Dhaka"
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all"
                />
              </div>
              <div>
                <label className="block font-medium mb-1.5 text-sm text-gray-700">Due Amount *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">৳</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="200"
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 pl-8 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all font-semibold text-lg"
                    required
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-[#1aaa55] text-white font-bold py-4 rounded-xl hover:bg-green-600 active:scale-[0.98] transition-all shadow-sm"
                >
                  Save Due
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        onConfirm={() => {
          if (deleteConfirm.id) handleDeleteCustomer(deleteConfirm.id);
        }}
        onCancel={() => setDeleteConfirm({isOpen: false, id: null})}
      />
    </div>
  );
}
