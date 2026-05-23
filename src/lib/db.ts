// Database Interface Definitions for Supabase

export interface Sale {
  id?: string;
  customer_name: string;
  items_details: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  profit: number;
  worker_name: string;
  business_id: string;
  created_at: string;
}

export interface Expense {
  id?: string;
  amount: number;
  description: string;
  business_id: string;
  created_at: string;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  balance: number;
  business_id: string;
}

export interface StockItem {
  id?: string;
  item_name: string;
  quantity: number;
  price: number;
  business_id: string;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  outstanding: number;
  business_id: string;
}

export interface Employee {
  id?: string;
  username: string;
  display_name: string;
  pin: string;
  role: string;
  position: string;
  status?: string; // 'pending' | 'approved' | 'blocked'
  commission_rate: number;
  salary: number;
  advance: number;
  sales_amount: number;
  business_id: string;
}
