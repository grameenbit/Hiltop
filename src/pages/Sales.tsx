import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sale } from '../lib/db';
import { Plus, Trash2, X, Loader2, Calculator } from 'lucide-react';
import { useAuth } from '../App';
import { getCachedData, setCachedData, enqueueSyncAction, executeOrEnqueue } from '../lib/sync';
import ConfirmModal from '../components/ConfirmModal';

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  const workerName = user?.email?.split('@')[0] || 'User';
  const isAdmin = user?.email === 'jackmytake@gmail.com';

  useEffect(() => {
    fetchSales();
    const handleSync = () => fetchSales();
    window.addEventListener('sync_completed', handleSync);
    window.addEventListener('online', handleSync);
    return () => {
      window.removeEventListener('sync_completed', handleSync);
      window.removeEventListener('online', handleSync);
    };
  }, []);

  const fetchSales = async () => {
    try {
      setLoading(true);
      let query = supabase.from('sales').select('*').order('created_at', { ascending: false });
      
      // If not admin, only show your own sales
      if (!isAdmin) {
        query = query.eq('worker_name', workerName);
      }

      const { data, error } = await query;

      if (error) {
        if (!navigator.onLine || error.message.includes('fetch')) throw new Error('Offline');
        throw error;
      }
      setSales(data || []);
      setCachedData('sales_' + (isAdmin ? 'admin' : workerName), data);
    } catch (err) {
      console.error('Error fetching sales:', err);
      const cached = getCachedData<Sale>('sales_' + (isAdmin ? 'admin' : workerName));
      setSales(cached);
    } finally {
      setLoading(false);
    }
  };

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [customerName, setCustomerName] = useState('Cash Customer');
  const [itemDetails, setItemDetails] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});

  // Calculator states
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcTarget, setCalcTarget] = useState<'total' | 'buy'>('total');
  const [calcExpression, setCalcExpression] = useState('');

  const calcResult = (() => {
    try {
      let expr = calcExpression.replace(/×/g, '*').replace(/÷/g, '/');
      if (!expr || !/^[0-9+\-*/().\s]*$/.test(expr)) return '';
      const val = new Function(`return (${expr})`)();
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        return Number(val.toFixed(2)).toString();
      }
      return '';
    } catch {
      return '';
    }
  })();

  const handleCalcPress = (val: string) => {
    if (val === 'C') {
      setCalcExpression('');
    } else if (val === 'Backspace') {
      setCalcExpression(prev => prev.slice(0, -1));
    } else if (val === '=') {
      if (calcResult) {
        setCalcExpression(calcResult);
      }
    } else {
      setCalcExpression(prev => prev + val);
    }
  };

  const runCalculationPre = (expr: string): string => {
    try {
      let cleanExpr = expr.replace(/×/g, '*').replace(/÷/g, '/');
      if (!cleanExpr || !/^[0-9+\-*/().\s]*$/.test(cleanExpr)) return '';
      const val = new Function(`return (${cleanExpr})`)();
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        return Number(val.toFixed(2)).toString();
      }
      return '';
    } catch {
      return '';
    }
  };

  const applyCalcResult = () => {
    const finalVal = calcResult || runCalculationPre(calcExpression) || calcExpression || '0';
    if (calcTarget === 'total') {
      setTotalAmount(finalVal);
    } else {
      setBuyPrice(finalVal);
    }
    setIsCalcOpen(false);
  };

  const openAddModal = () => {
    setCustomerName('Cash Customer');
    setItemDetails('');
    setTotalAmount('');
    setPaidAmount('');
    setBuyPrice('');
    setIsAddOpen(true);
  };

  const openEditModal = (sale: Sale) => {
    setSelectedSale(sale);
    setCustomerName(sale.customer_name || 'Cash Customer');
    setItemDetails(sale.items_details);
    setTotalAmount(sale.total_amount.toString());
    setPaidAmount(sale.paid_amount.toString());
    const derivedBuyPrice = sale.total_amount - (sale.profit || 0);
    setBuyPrice(derivedBuyPrice > 0 ? derivedBuyPrice.toString() : '0');
    setIsEditOpen(true);
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDetails || !totalAmount) return;

    const finalCustomerName = customerName || 'Cash Customer';
    const finalTotalAmount = parseFloat(totalAmount) || 0;
    const finalBuyPrice = parseFloat(buyPrice) || 0;
    const finalProfit = finalTotalAmount - finalBuyPrice;

    try {
      if (isEditOpen && selectedSale && selectedSale.id) {
        const payload = {
          customer_name: finalCustomerName,
          items_details: itemDetails,
          total_amount: finalTotalAmount,
          paid_amount: finalTotalAmount, // fully paid
          due_amount: 0,
          profit: finalProfit
        };

        await executeOrEnqueue(
          { type: 'update', table: 'sales', payload, match: { id: selectedSale.id } },
          () => {
            const updatedSales = sales.map(s => s.id === selectedSale.id ? { ...s, ...payload } as Sale : s);
            setSales(updatedSales);
            setCachedData('sales_' + (isAdmin ? 'admin' : workerName), updatedSales);
          },
          fetchSales
        );
      } else {
        const newSale: any = {
          id: crypto.randomUUID(),
          customer_name: finalCustomerName,
          items_details: itemDetails,
          total_amount: finalTotalAmount,
          paid_amount: finalTotalAmount, // fully paid
          due_amount: 0,
          profit: finalProfit, 
          worker_name: workerName,
          business_id: 'temp-id'
        };

        await executeOrEnqueue(
          { type: 'insert', table: 'sales', payload: newSale },
          () => {
            const updatedSales = [{ ...newSale } as Sale, ...sales];
            setSales(updatedSales);
            setCachedData('sales_' + (isAdmin ? 'admin' : workerName), updatedSales);
          },
          fetchSales
        );
      }

      setIsAddOpen(false);
      setIsEditOpen(false);
      setCustomerName('Cash Customer');
      setItemDetails('');
      setTotalAmount('');
      setPaidAmount('');
      setBuyPrice('');
    } catch (err) {
      console.error('Failed to save sale:', err);
      alert('Error saving to Supabase. Make sure you ran the SQL schema.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (typeof id === 'string' && id.startsWith('temp-')) {
        const updatedSales = sales.filter(s => s.id !== id);
        setSales(updatedSales);
        setCachedData('sales_' + (isAdmin ? 'admin' : workerName), updatedSales);
        return;
      }
      await executeOrEnqueue(
        { type: 'delete', table: 'sales', payload: {}, match: { id } },
        () => {
          const updatedSales = sales.filter(s => s.id !== id);
          setSales(updatedSales);
          setCachedData('sales_' + (isAdmin ? 'admin' : workerName), updatedSales);
        },
        fetchSales
      );
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Sales</h2>
          <p className="text-sm font-medium text-gray-500">Transaction history</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="bg-[#1aaa55] text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 active:scale-95 transition-all shadow-md"
        >
          <Plus size={18} />
          New Sale
        </button>
      </div>

      <div className="space-y-4 pb-24 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-sm font-medium">Fetching from Cloud...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-[32px] border border-gray-100 shadow-sm italic text-gray-400">
            No sales recorded yet.
          </div>
        ) : (
          sales.map((sale) => (
            <div key={sale.id} className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex flex-col relative hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div>
                   <h3 className="font-bold text-lg text-gray-900">{sale.customer_name}</h3>
                   <div className="flex items-center gap-2 mt-0.5">
                     <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500">
                       {sale.created_at ? new Date(sale.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Pending'}
                     </span>
                     <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                     <span className="text-[10px] font-bold text-[#1aaa55] uppercase tracking-wider">{sale.worker_name}</span>
                   </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => openEditModal(sale)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors bg-gray-50 rounded-full">
                       <span className="text-[10px] font-bold uppercase tracking-wider">Edit</span>
                    </button>
                    <button onClick={() => setDeleteConfirm({isOpen: true, id: sale.id!})} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors bg-gray-50 rounded-full">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="bg-gray-50 p-3 rounded-xl mb-4 border border-gray-100/50">
                <p className="text-sm text-gray-600 font-medium leading-relaxed">{sale.items_details}</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-50">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">কেনা (Cost)</p>
                  <p className="font-bold text-base text-gray-500">৳{(sale.total_amount - (sale.profit || 0)).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">বিক্রি (Sale)</p>
                  <p className="font-bold text-base text-gray-900">৳{sale.total_amount.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-[#1aaa55]/85 uppercase tracking-widest mb-1">লাভ (Profit)</p>
                  <p className="font-bold text-base text-[#1aaa55]">৳{(sale.profit || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Sale Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full sm:max-w-md h-auto rounded-[32px] flex flex-col shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center p-7 border-b border-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{isEditOpen ? 'Edit Transaction' : 'New Transaction'}</h2>
              <button onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="bg-gray-100 hover:bg-gray-200 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveSale} className="flex-1 overflow-y-auto p-7 space-y-6">
              <div>
                <label className="block font-bold mb-2 text-xs text-gray-500 uppercase tracking-wider ml-1">Items & Details * (পণ্য ও বিবরণ)</label>
                <textarea 
                  value={itemDetails}
                  onChange={(e) => setItemDetails(e.target.value)}
                  placeholder="e.g. Shirt x2, Pant x1 Blue"
                  className="w-full bg-white border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all min-h-[100px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-2 text-[11px] text-gray-500 uppercase tracking-wider ml-1">কেনা দাম (Cost) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">৳</span>
                    <input 
                      type="number" 
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-gray-200 rounded-2xl p-4 pl-8 pr-12 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all font-bold text-sm"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setCalcTarget('buy');
                        setCalcExpression(buyPrice);
                        setIsCalcOpen(true);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1aaa55] p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
                      title="Open Calculator"
                    >
                      <Calculator size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-2 text-[11px] text-gray-500 uppercase tracking-wider ml-1 font-sans">মোট বিক্রি (Sell) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">৳</span>
                    <input 
                      type="number" 
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-gray-200 rounded-2xl p-4 pl-8 pr-12 outline-none focus:ring-2 focus:ring-[#1aaa55]/20 focus:border-[#1aaa55] transition-all font-bold text-sm"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setCalcTarget('total');
                        setCalcExpression(totalAmount);
                        setIsCalcOpen(true);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1aaa55] p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
                      title="Open Calculator"
                    >
                      <Calculator size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-[#1aaa55] text-white font-bold py-5 rounded-2xl hover:bg-green-600 active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(26,170,85,0.25)]"
                >
                  Complete Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mini Calculator Modal Overlay */}
      {isCalcOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-6 max-w-xs w-full shadow-2xl relative overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-sm">
                {calcTarget === 'total' ? 'বিক্রি দাম হিসাব (Sell Calc)' : 'কেনা দাম হিসাব (Cost Calc)'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsCalcOpen(false)} 
                className="bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Display screen */}
            <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-right border border-gray-100/50 min-h-[74px] flex flex-col justify-between">
              <div className="text-gray-400 text-xs font-mono truncate tracking-wide">
                {calcExpression || '0'}
              </div>
              <div className="text-xl font-black text-gray-800 font-mono tracking-tight truncate">
                ৳{calcResult || runCalculationPre(calcExpression) || '0'}
              </div>
            </div>

            {/* Calculator Buttons Grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {/* Row 1 */}
              <button type="button" onClick={() => handleCalcPress('7')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">7</button>
              <button type="button" onClick={() => handleCalcPress('8')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">8</button>
              <button type="button" onClick={() => handleCalcPress('9')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">9</button>
              <button type="button" onClick={() => handleCalcPress('÷')} className="h-10 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold rounded-xl text-base active:scale-95 transition-all">÷</button>

              {/* Row 2 */}
              <button type="button" onClick={() => handleCalcPress('4')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">4</button>
              <button type="button" onClick={() => handleCalcPress('5')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">5</button>
              <button type="button" onClick={() => handleCalcPress('6')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">6</button>
              <button type="button" onClick={() => handleCalcPress('×')} className="h-10 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold rounded-xl text-base active:scale-95 transition-all">×</button>

              {/* Row 3 */}
              <button type="button" onClick={() => handleCalcPress('1')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">1</button>
              <button type="button" onClick={() => handleCalcPress('2')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">2</button>
              <button type="button" onClick={() => handleCalcPress('3')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">3</button>
              <button type="button" onClick={() => handleCalcPress('-')} className="h-10 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold rounded-xl text-base active:scale-95 transition-all">-</button>

              {/* Row 4 */}
              <button type="button" onClick={() => handleCalcPress('0')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">0</button>
              <button type="button" onClick={() => handleCalcPress('.')} className="h-10 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-base active:scale-95 transition-all">.</button>
              <button type="button" onClick={() => handleCalcPress('C')} className="h-10 bg-red-50 hover:bg-red-100 text-red-500 font-bold rounded-xl text-base active:scale-95 transition-all">C</button>
              <button type="button" onClick={() => handleCalcPress('+')} className="h-10 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold rounded-xl text-base active:scale-95 transition-all">+</button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button 
                type="button" 
                onClick={() => handleCalcPress('Backspace')}
                className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs active:scale-95 transition-all"
              >
                ডিলেট করুন (Del)
              </button>
              <button 
                type="button" 
                onClick={() => handleCalcPress('=')}
                className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs active:scale-95 transition-all shadow-sm"
              >
                সমান (=)
              </button>
            </div>

            <button
              type="button"
              onClick={applyCalcResult}
              className="w-full bg-[#1aaa55] text-white font-bold py-3 rounded-xl hover:bg-green-600 active:scale-95 transition-all shadow-sm text-xs cursor-pointer"
            >
              টাকা বসান (Apply Result)
            </button>
          </div>
        </div>
      )}
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This action cannot be undone."
        onConfirm={() => {
          if (deleteConfirm.id) handleDelete(deleteConfirm.id);
        }}
        onCancel={() => setDeleteConfirm({isOpen: false, id: null})}
      />
    </div>
  );
}
