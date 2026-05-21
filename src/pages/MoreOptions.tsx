import { User, ChevronRight, Truck, Users, Settings, HelpCircle, LogOut, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import appIcon from '../assets/images/alif_garments_icon.png';

export default function MoreOptions() {
  const { signOut, isAdmin } = useAuth();

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">More</h2>
        <p className="text-gray-500 font-medium text-sm">Account & Management options</p>
      </div>

      <div className="space-y-4">
        <Link
          to="/profile"
          className="flex items-center justify-between p-5 bg-white rounded-[24px] shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#1aaa55]/10 text-[#1aaa55] rounded-2xl flex items-center justify-center">
              <User size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">My Profile</h3>
              <p className="text-sm text-gray-500">Salary & performance overview</p>
            </div>
          </div>
          <ChevronRight className="text-gray-400" size={24} />
        </Link>

        {/* Inventory Section */}
        <div className="bg-white rounded-[24px] p-2 shadow-sm border border-gray-100">
          <Link
            to="/stock"
            className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                <Package size={20} />
              </div>
              <span className="font-bold text-gray-900">Stock Management</span>
            </div>
            <ChevronRight className="text-gray-400" size={20} />
          </Link>
        </div>

        {/* Management Section */}
        {isAdmin && (
          <div className="bg-white rounded-[24px] p-2 shadow-sm border border-gray-100">
            <Link
              to="/suppliers"
              className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <Truck size={20} />
                </div>
                <span className="font-bold text-gray-900">Manage Suppliers</span>
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </Link>
            <div className="h-px bg-gray-50 mx-4"></div>
            <Link
              to="/employees"
              className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Users size={20} />
                </div>
                <span className="font-bold text-gray-900">Manage Staff</span>
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </Link>
          </div>
        )}

        {/* Footer info/settings maybe? */}
        <div className="bg-white rounded-[24px] p-2 shadow-sm border border-gray-100">
           <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-50 text-gray-500 rounded-xl flex items-center justify-center">
                <Settings size={20} />
              </div>
              <span className="font-bold text-gray-900">App Settings</span>
            </div>
            <ChevronRight className="text-gray-400" size={20} />
          </button>
          <div className="h-px bg-gray-50 mx-4"></div>
          <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-50 text-gray-500 rounded-xl flex items-center justify-center">
                <HelpCircle size={20} />
              </div>
              <span className="font-bold text-gray-900">Help & Support</span>
            </div>
            <ChevronRight className="text-gray-400" size={20} />
          </button>
        </div>

        <button 
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 p-5 bg-red-50 text-red-600 rounded-[24px] font-bold shadow-sm border border-red-100 hover:bg-red-100 transition-colors"
        >
          <LogOut size={20} />
          Logout from account
        </button>
      </div>

      <div className="bg-gradient-to-br from-[#1aaa55]/5 to-[#128a45]/5 rounded-[24px] p-5 shadow-inner border border-gray-100 flex flex-col items-center text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border-2 border-white">
          <img 
            src={appIcon} 
            alt="App Icon" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer" 
          />
        </div>
        <div>
          <h4 className="font-bold text-gray-800 text-sm">নতুন ব্রান্ড অ্যাপ আইকন</h4>
          <p className="text-xs text-gray-500 max-w-[280px] mt-1 leading-relaxed">
            মিনিমালিস্ট ও ইউনিক ডিজাইনের এই আধুনিক আইকনটি ওয়েবসাইট এবং এন্ড্রয়েড (Android APK) অ্যাপের মূল আইকন হিসেবে সফলভাবে যুক্ত করা হয়েছে।
          </p>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] uppercase tracking-wider font-extrabold bg-[#1aaa55]/10 text-[#1aaa55] px-2 py-0.5 rounded-full">Android Icon Ready</span>
          <span className="text-[10px] uppercase tracking-wider font-extrabold bg-[#1aaa55]/10 text-[#1aaa55] px-2 py-0.5 rounded-full">Web Icon Live</span>
        </div>
      </div>

      <p className="text-center text-xs font-bold text-gray-300 uppercase tracking-widest pt-4">Alif Garments v2.1.0</p>
    </div>
  );
}
