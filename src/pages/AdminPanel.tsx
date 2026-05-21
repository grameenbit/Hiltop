import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sale, Customer, Supplier, Employee } from '../lib/db';
import { TrendingUp, Users, Truck, Wallet, Activity, Loader2, Settings, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCachedData, setCachedData } from '../lib/sync';

export default function AdminPanel() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    fetchAdminData();
    
    const handleStatus = () => setIsOnline(navigator.onLine);
    const handleSync = () => fetchAdminData();
    
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    window.addEventListener('sync_completed', handleSync);
    
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      window.removeEventListener('sync_completed', handleSync);
    };
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [salesRes, customersRes, suppliersRes, employeesRes] = await Promise.all([
        supabase.from('sales').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('profiles').select('*')
      ]);

      if (salesRes.error || customersRes.error || suppliersRes.error || employeesRes.error) {
        throw new Error('Fetch failed');
      }

      setSales(salesRes.data || []);
      setCustomers(customersRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setEmployees(employeesRes.data || []);
      
      setCachedData('admin_sales', salesRes.data);
      setCachedData('admin_customers', customersRes.data);
      setCachedData('admin_suppliers', suppliersRes.data);
      setCachedData('admin_employees', employeesRes.data);
    } catch (err) {
      console.error('Admin fetching error:', err);
      // Fallback
      setSales(getCachedData('admin_sales'));
      setCustomers(getCachedData('admin_customers'));
      setSuppliers(getCachedData('admin_suppliers'));
      setEmployees(getCachedData('admin_employees'));
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const totalSales = sales.reduce((acc, sale) => acc + Number(sale.total_amount), 0);
  const todaySalesSummary = sales.reduce((acc, sale) => {
    if (sale.created_at?.startsWith(todayStr)) return acc + Number(sale.total_amount);
    return acc;
  }, 0);

  const totalProfit = sales.reduce((acc, sale) => acc + Number(sale.profit || 0), 0);
  const todayProfit = sales.reduce((acc, sale) => {
    if (sale.created_at?.startsWith(todayStr)) return acc + Number(sale.profit || 0);
    return acc;
  }, 0);

  const totalCustomerDue = customers.reduce((acc, c) => acc + Number(c.balance || 0), 0);
  const totalSupplierDue = suppliers.reduce((acc, supplier) => acc + supplier.outstanding, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="animate-spin text-[#1aaa55]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 bg-[#f8fafc] min-h-screen pb-24 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Overview</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 font-medium text-sm">Shop performance & metrics</p>
            {isOnline ? (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                <Wifi size={10} /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                <WifiOff size={10} /> Offline
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="bg-[#1aaa55]/10 text-[#1aaa55] px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-[#1aaa55]/20 shadow-sm">
            <Users size={14} />
            {employees.length} Users active
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider">Today's Sales</h3>
            <TrendingUp size={18} className="text-[#1aaa55]" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">৳ {todaySalesSummary.toLocaleString()}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600">Total</span>
            <p className="text-xs text-gray-500 font-medium">৳ {totalSales.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider">Today's Profit</h3>
            <Activity size={18} className="text-[#1aaa55]" />
          </div>
          <p className="text-2xl font-bold text-[#1aaa55] mb-1">৳ {todayProfit.toLocaleString()}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600">Total</span>
            <p className="text-xs text-gray-500 font-medium">৳ {totalProfit.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Customer Due */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Total Customer Due</h3>
            <p className="text-2xl font-bold text-orange-500">৳ {totalCustomerDue.toLocaleString()}</p>
          </div>
          <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center border border-orange-100">
            <Users size={24} className="text-orange-500" />
          </div>
        </div>

        {/* Supplier Due */}
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Total Supplier Due</h3>
            <p className="text-2xl font-bold text-red-500">৳ {totalSupplierDue.toLocaleString()}</p>
          </div>
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center border border-red-100">
            <Truck size={24} className="text-red-500" />
          </div>
        </div>
      </div>

      {/* Recent Activity / Users Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-5">
             <h3 className="font-bold text-lg text-gray-900 tracking-tight">Registered Staff</h3>
             <Link to="/admin-users" className="text-[#1aaa55] text-sm font-semibold hover:underline">Manage All</Link>
          </div>
          <div className="space-y-4">
             {employees.slice(0, 5).map(emp => (
               <div key={emp.id} className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-[#1aaa55] font-bold text-sm border border-gray-100">
                     {emp.display_name ? emp.display_name[0].toUpperCase() : 'U'}
                   </div>
                   <div>
                     <p className="font-bold text-gray-900 text-sm leading-tight">{emp.display_name}</p>
                     <p className="text-[#1aaa55] text-[10px] font-bold">{emp.username}</p>
                     <p className="text-gray-400 text-[9px] font-medium">{emp.email}</p>
                   </div>
                 </div>
                 <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${emp.role === 'admin' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                   {emp.role}
                 </div>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-5">
             <h3 className="font-bold text-lg text-gray-900 tracking-tight">Recent Sales</h3>
             <Link to="/sales" className="text-[#1aaa55] text-sm font-semibold hover:underline">View All</Link>
          </div>
          {sales.length === 0 ? (
            <div className="text-center py-8">
              <Wallet size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No recent sales.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sales.slice(-5).reverse().map(sale => (
                <div key={sale.id} className="flex justify-between items-center hover:bg-gray-50 p-3 -mx-3 rounded-xl transition-colors">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{sale.customer_name}</p>
                    <p className="text-[10px] font-medium text-gray-500 mt-0.5">{sale.worker_name} • {sale.items_details}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#1aaa55] text-sm">৳{sale.total_amount}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Link to="/suppliers" className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center hover:border-[#1aaa55]/30 hover:shadow-md transition-all group">
           <div className="w-12 h-12 bg-purple-50 group-hover:bg-purple-100 transition-colors rounded-full flex items-center justify-center mb-3">
             <Truck size={22} className="text-purple-600" />
           </div>
           <span className="font-semibold text-gray-900 text-sm">Suppliers</span>
        </Link>
        <Link to="/employees" className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center hover:border-[#1aaa55]/30 hover:shadow-md transition-all group">
           <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-100 transition-colors rounded-full flex items-center justify-center mb-3">
             <Users size={22} className="text-blue-600" />
           </div>
           <span className="font-semibold text-gray-900 text-sm">Employees</span>
        </Link>
        <Link to="/admin-users" className="col-span-2 bg-gradient-to-r from-[#1aaa55] to-green-600 p-6 rounded-[24px] shadow-lg flex items-center justify-between group overflow-hidden relative">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform duration-500"></div>
           <div className="relative z-10">
             <h3 className="text-white font-black text-xl">User & Staff Management</h3>
             <p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-1">Manage Roles, Salary & access</p>
           </div>
           <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm group-hover:bg-white group-hover:text-[#1aaa55] transition-all">
             <Settings size={28} />
           </div>
        </Link>
      </div>

    </div>
  );
}
