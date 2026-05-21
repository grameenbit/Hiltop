import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserCircle, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../App';
import { Sale, Customer, Employee } from '../lib/db';
import { getCachedData, setCachedData } from '../lib/sync';

export default function Dashboard() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employeeInfo, setEmployeeInfo] = useState<Partial<Employee>>({});
  const [loading, setLoading] = useState(true);
  
  const displayName = employeeInfo.display_name || user?.email?.split('@')[0] || 'User';

  useEffect(() => {
    if (user) {
      fetchData();
    }
    const handleSync = () => { if (user) fetchData(); };
    window.addEventListener('sync_completed', handleSync);
    window.addEventListener('online', handleSync);
    return () => {
      window.removeEventListener('sync_completed', handleSync);
      window.removeEventListener('online', handleSync);
    };
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0,0,0,0);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Fetch employee info FIRST to get the correct display name and username
      const { data: empData, error: empError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();
      
      if (empError) {
        if (!navigator.onLine || empError.message.includes('fetch')) throw new Error('Offline');
      }

      let currentWorkerName = displayName;
      if (empData) {
        setEmployeeInfo(empData);
        currentWorkerName = empData.display_name || currentWorkerName;
        setCachedData('dashboard_emp', empData);
      }

      // Fetch sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('worker_name', currentWorkerName)
        .gte('created_at', startOfMonth.toISOString());
      
      if (salesError && (!navigator.onLine || salesError.message.includes('fetch'))) throw new Error("Offline");
      setSales(salesData || []);
      setCachedData('dashboard_sales', salesData);

      // Fetch customers
      const { data: customerData, error: custError } = await supabase
        .from('customers')
        .select('*');
      
      if (custError && (!navigator.onLine || custError.message.includes('fetch'))) throw new Error("Offline");
      setCustomers(customerData || []);
      setCachedData('dashboard_customers', customerData);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      // fallback
      setEmployeeInfo(getCachedData('dashboard_emp') as Partial<Employee> || {});
      setSales(getCachedData('dashboard_sales') || []);
      setCustomers(getCachedData('dashboard_customers') || []);
    } finally {
      setLoading(false);
    }
  };
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySalesSummary = sales.reduce((acc, sale) => {
    if (sale.created_at?.startsWith(todayStr)) return acc + Number(sale.total_amount);
    return acc;
  }, 0);

  const totalMonthSales = sales.reduce((acc, sale) => acc + Number(sale.total_amount), 0);
  const totalCustomerDue = customers.reduce((acc, c) => acc + Number(c.balance || 0), 0);

  const commissionRatePercent = employeeInfo.commission_rate || 5;
  const myCommission = todaySalesSummary * (commissionRatePercent / 100); 
  const thisMonthCommission = totalMonthSales * (commissionRatePercent / 100);
  const salary = employeeInfo.salary || 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1aaa55]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-300">
      
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 items-center justify-center text-center flex flex-col pt-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#1aaa55]/10 to-transparent"></div>
        <div className="w-20 h-20 bg-white border-4 border-white shadow-xl text-[#1aaa55] rounded-full flex items-center justify-center mb-4 relative z-10">
           {employeeInfo.display_name ? (
             <span className="text-3xl font-bold uppercase">{employeeInfo.display_name[0]}</span>
           ) : (
             <UserCircle size={40} />
           )}
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 relative z-10">
           {displayName}
        </h2>
        <p className="text-sm font-bold text-[#1aaa55] mb-6 relative z-10">
           {employeeInfo.username || '@username'}
        </p>

        <div className="grid grid-cols-2 gap-4 w-full text-left relative z-10">
          <div className="bg-[#f8fafc] hover:bg-white transition-colors p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Today's Sales</h3>
            <p className="text-2xl font-bold text-gray-900">৳ {todaySalesSummary.toLocaleString()}</p>
            <p className="text-sm font-medium text-[#1aaa55] mt-1">+{sales.filter(s => s.created_at?.startsWith(todayStr)).length} orders</p>
          </div>
          <div className="bg-[#f8fafc] hover:bg-white transition-colors p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">My Commission</h3>
            <p className="text-2xl font-bold text-[#1aaa55]">৳ {myCommission.toLocaleString()}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">{commissionRatePercent}% rate</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-5 text-gray-900">Collections Summary</h3>
        <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
          <div>
            <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Total Customer Due</p>
            <p className="text-2xl font-black text-orange-600">৳ {totalCustomerDue.toLocaleString()}</p>
          </div>
          <div className="bg-white p-2 rounded-xl shadow-sm text-orange-500">
            <Users size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg mb-5 text-gray-900">This Month's Earnings</h3>
        <div className="space-y-4">
           <div className="flex justify-between items-center text-gray-600 p-3 bg-gray-50 rounded-xl">
             <span className="font-medium">Total Sales Generated</span>
             <span className="font-bold text-gray-900">৳ {totalMonthSales.toLocaleString()}</span>
           </div>
           <div className="flex justify-between items-center text-gray-600 p-3 bg-green-50/50 rounded-xl">
             <span className="font-medium text-[#1aaa55]">Est. Commission</span>
             <span className="font-bold text-[#1aaa55]">৳ {thisMonthCommission.toLocaleString()}</span>
           </div>
           <div className="flex justify-between items-center text-gray-600 p-3 bg-gray-50 rounded-xl">
             <span className="font-medium">Base Salary</span>
             <span className="font-bold text-gray-900">৳ {salary.toLocaleString()}</span>
           </div>
        </div>
      </div>

    </div>
  );
}
