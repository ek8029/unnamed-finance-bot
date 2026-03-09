/**
 * Seed Transaction Categories
 * Populates the transaction_categories table with common categories
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const categories = [
  // Income
  { name: 'Salary', category_group: 'Income', icon: 'dollar-sign', color: '#10b981', is_income: true },
  { name: 'Bonus', category_group: 'Income', icon: 'gift', color: '#10b981', is_income: true },
  { name: 'Freelance', category_group: 'Income', icon: 'briefcase', color: '#10b981', is_income: true },
  { name: 'Refund', category_group: 'Income', icon: 'rotate-ccw', color: '#10b981', is_income: true },
  { name: 'Interest Income', category_group: 'Income', icon: 'percent', color: '#10b981', is_income: true },
  { name: 'Dividend Income', category_group: 'Income', icon: 'bar-chart', color: '#10b981', is_income: true },
  { name: 'Capital Gains', category_group: 'Income', icon: 'trending-up', color: '#10b981', is_income: true },
  { name: 'Rental Income', category_group: 'Income', icon: 'home', color: '#10b981', is_income: true },
  { name: 'Other Income', category_group: 'Income', icon: 'plus-circle', color: '#10b981', is_income: true },

  // Food & Drink
  { name: 'Groceries', category_group: 'Food & Drink', icon: 'shopping-cart', color: '#f59e0b', is_expense: true },
  { name: 'Dining', category_group: 'Food & Drink', icon: 'utensils', color: '#f59e0b', is_expense: true },
  { name: 'Coffee', category_group: 'Food & Drink', icon: 'coffee', color: '#f59e0b', is_expense: true },
  { name: 'Fast Food', category_group: 'Food & Drink', icon: 'pizza', color: '#f59e0b', is_expense: true },
  { name: 'Alcohol & Bars', category_group: 'Food & Drink', icon: 'wine', color: '#f59e0b', is_expense: true },

  // Transportation
  { name: 'Gas', category_group: 'Transportation', icon: 'fuel', color: '#3b82f6', is_expense: true },
  { name: 'Uber/Lyft', category_group: 'Transportation', icon: 'car', color: '#3b82f6', is_expense: true },
  { name: 'Public Transit', category_group: 'Transportation', icon: 'train', color: '#3b82f6', is_expense: true },
  { name: 'Parking', category_group: 'Transportation', icon: 'square-parking', color: '#3b82f6', is_expense: true },
  { name: 'Auto Insurance', category_group: 'Transportation', icon: 'shield', color: '#3b82f6', is_expense: true },
  { name: 'Auto Maintenance', category_group: 'Transportation', icon: 'wrench', color: '#3b82f6', is_expense: true },

  // Shopping
  { name: 'Clothing', category_group: 'Shopping', icon: 'shirt', color: '#ec4899', is_expense: true },
  { name: 'Electronics', category_group: 'Shopping', icon: 'laptop', color: '#ec4899', is_expense: true },
  { name: 'Home Goods', category_group: 'Shopping', icon: 'home', color: '#ec4899', is_expense: true },
  { name: 'Personal Care', category_group: 'Shopping', icon: 'sparkles', color: '#ec4899', is_expense: true },
  { name: 'Amazon', category_group: 'Shopping', icon: 'package', color: '#ec4899', is_expense: true },
  { name: 'General Shopping', category_group: 'Shopping', icon: 'shopping-bag', color: '#ec4899', is_expense: true },

  // Entertainment
  { name: 'Movies', category_group: 'Entertainment', icon: 'film', color: '#8b5cf6', is_expense: true },
  { name: 'Streaming', category_group: 'Entertainment', icon: 'tv', color: '#8b5cf6', is_expense: true },
  { name: 'Music', category_group: 'Entertainment', icon: 'music', color: '#8b5cf6', is_expense: true },
  { name: 'Gaming', category_group: 'Entertainment', icon: 'gamepad', color: '#8b5cf6', is_expense: true },
  { name: 'Events', category_group: 'Entertainment', icon: 'ticket', color: '#8b5cf6', is_expense: true },
  { name: 'Subscriptions', category_group: 'Entertainment', icon: 'repeat', color: '#8b5cf6', is_expense: true },

  // Bills & Utilities
  { name: 'Rent', category_group: 'Bills & Utilities', icon: 'home', color: '#ef4444', is_expense: true },
  { name: 'Mortgage', category_group: 'Bills & Utilities', icon: 'building', color: '#ef4444', is_expense: true },
  { name: 'Electric', category_group: 'Bills & Utilities', icon: 'zap', color: '#ef4444', is_expense: true },
  { name: 'Water', category_group: 'Bills & Utilities', icon: 'droplet', color: '#ef4444', is_expense: true },
  { name: 'Internet', category_group: 'Bills & Utilities', icon: 'wifi', color: '#ef4444', is_expense: true },
  { name: 'Phone', category_group: 'Bills & Utilities', icon: 'smartphone', color: '#ef4444', is_expense: true },
  { name: 'Home Insurance', category_group: 'Bills & Utilities', icon: 'shield-check', color: '#ef4444', is_expense: true },

  // Healthcare
  { name: 'Doctor', category_group: 'Healthcare', icon: 'stethoscope', color: '#06b6d4', is_expense: true },
  { name: 'Pharmacy', category_group: 'Healthcare', icon: 'pill', color: '#06b6d4', is_expense: true },
  { name: 'Dental', category_group: 'Healthcare', icon: 'smile', color: '#06b6d4', is_expense: true },
  { name: 'Health Insurance', category_group: 'Healthcare', icon: 'heart-pulse', color: '#06b6d4', is_expense: true },
  { name: 'Vision', category_group: 'Healthcare', icon: 'eye', color: '#06b6d4', is_expense: true },
  { name: 'Gym & Fitness', category_group: 'Healthcare', icon: 'dumbbell', color: '#06b6d4', is_expense: true },

  // Education
  { name: 'Tuition', category_group: 'Education', icon: 'graduation-cap', color: '#0ea5e9', is_expense: true },
  { name: 'Books', category_group: 'Education', icon: 'book', color: '#0ea5e9', is_expense: true },
  { name: 'Courses', category_group: 'Education', icon: 'school', color: '#0ea5e9', is_expense: true },
  { name: 'Student Loans', category_group: 'Education', icon: 'landmark', color: '#0ea5e9', is_expense: true },

  // Investments & Savings
  { name: 'Stock Purchase', category_group: 'Investments', icon: 'chart-line', color: '#059669', is_expense: true },
  { name: 'Crypto Purchase', category_group: 'Investments', icon: 'bitcoin', color: '#059669', is_expense: true },
  { name: 'Retirement Contribution', category_group: 'Investments', icon: 'piggy-bank', color: '#059669', is_expense: true },
  { name: 'Savings Deposit', category_group: 'Investments', icon: 'vault', color: '#059669', is_expense: true },

  // Debt Payments
  { name: 'Credit Card Payment', category_group: 'Debt', icon: 'credit-card', color: '#f97316', is_expense: true },
  { name: 'Loan Payment', category_group: 'Debt', icon: 'landmark', color: '#f97316', is_expense: true },
  { name: 'Mortgage Payment', category_group: 'Debt', icon: 'building', color: '#f97316', is_expense: true },

  // Transfers
  { name: 'Transfer In', category_group: 'Transfers', icon: 'arrow-down', color: '#64748b', is_transfer: true },
  { name: 'Transfer Out', category_group: 'Transfers', icon: 'arrow-up', color: '#64748b', is_transfer: true },
  { name: 'ACH Transfer', category_group: 'Transfers', icon: 'arrow-left-right', color: '#64748b', is_transfer: true },

  // Fees & Charges
  { name: 'Bank Fees', category_group: 'Fees & Charges', icon: 'alert-circle', color: '#dc2626', is_expense: true },
  { name: 'ATM Fees', category_group: 'Fees & Charges', icon: 'banknote', color: '#dc2626', is_expense: true },
  { name: 'Late Fees', category_group: 'Fees & Charges', icon: 'clock', color: '#dc2626', is_expense: true },
  { name: 'Service Charges', category_group: 'Fees & Charges', icon: 'receipt', color: '#dc2626', is_expense: true },

  // Travel
  { name: 'Flights', category_group: 'Travel', icon: 'plane', color: '#0d9488', is_expense: true },
  { name: 'Hotels', category_group: 'Travel', icon: 'bed', color: '#0d9488', is_expense: true },
  { name: 'Travel Other', category_group: 'Travel', icon: 'map', color: '#0d9488', is_expense: true },

  // Other
  { name: 'Gifts', category_group: 'Other', icon: 'gift', color: '#6366f1', is_expense: true },
  { name: 'Charity', category_group: 'Other', icon: 'heart', color: '#6366f1', is_expense: true },
  { name: 'Taxes', category_group: 'Other', icon: 'receipt', color: '#6366f1', is_expense: true },
  { name: 'Pet Care', category_group: 'Other', icon: 'paw-print', color: '#6366f1', is_expense: true },
  { name: 'Childcare', category_group: 'Other', icon: 'baby', color: '#6366f1', is_expense: true },
  { name: 'Other', category_group: 'Other', icon: 'more-horizontal', color: '#6366f1', is_expense: true },
];

async function seedCategories() {
  console.log('🌱 Seeding transaction categories...');

  try {
    const { data, error } = await supabase
      .from('transaction_categories')
      .upsert(categories, { onConflict: 'name', ignoreDuplicates: false });

    if (error) {
      console.error('❌ Error seeding categories:', error);
      return;
    }

    console.log(`✅ Successfully seeded ${categories.length} transaction categories`);

    // Count by type
    const income = categories.filter(c => c.is_income).length;
    const expense = categories.filter(c => c.is_expense).length;
    const transfer = categories.filter(c => c.is_transfer).length;

    console.log('📊 Category breakdown:');
    console.log(`   - Income: ${income}`);
    console.log(`   - Expense: ${expense}`);
    console.log(`   - Transfer: ${transfer}`);
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

seedCategories();
