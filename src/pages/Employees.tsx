import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../lib/db';
import { Plus, ArrowLeft, Loader2, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCachedData, setCachedData } from '../lib/sync';

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      
      if (error) {
        if (!navigator.onLine || error.message.includes('fetch')) {
          throw new Error('Offline');
        }
        throw error;
      }
      setEmployees(data || []);
      setCachedData('employees_list', data);
    } catch (err) {
      console.error('Error fetching employees:', err);
      const cached = getCachedData<Employee>('employees_list');
      setEmployees(cached);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/more" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">Staff Members</h2>
      </div>

      <div className="space-y-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#1aaa55]" size={32} />
          </div>
        ) : employees.length === 0 ? (
           <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100 italic text-gray-400">
             No employees found.
           </div>
        ) : (
          employees.map((emp) => (
            <div key={emp.id} className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-[#1aaa55]/10 text-[#1aaa55] rounded-full flex items-center justify-center font-bold">
                     {emp.display_name[0]?.toUpperCase()}
                   </div>
                   <div>
                     <h3 className="font-bold text-gray-900">{emp.display_name}</h3>
                     <p className="text-[10px] font-bold text-[#1aaa55] uppercase tracking-widest">{emp.username}</p>
                   </div>
                </div>
                <Link to="/admin-users" className="text-gray-300 hover:text-[#1aaa55] transition-colors">
                  <Shield size={18} />
                </Link>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Sales</p>
                  <p className="font-bold text-gray-900">৳ {emp.sales_amount.toLocaleString()}</p>
                </div>
                <div className="bg-green-50/50 p-2 rounded-xl border border-green-100/50">
                  <p className="text-[9px] font-bold text-[#1aaa55] uppercase mb-1">Comm {emp.commission_rate}%</p>
                  <p className="font-bold text-[#1aaa55]">৳ {(emp.sales_amount * emp.commission_rate / 100).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Base Salary</p>
                  <p className="font-bold text-gray-900">৳ {emp.salary.toLocaleString()}</p>
                </div>
              </div>

              {emp.advance > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-tighter flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Advance: ৳ {emp.advance.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
