/**
 * Seed losing positions + realized capital gains for helmterminal@gmail.com
 * Adds holdings with unrealized losses and some realized gain/loss transactions.
 *
 * Usage: npx tsx scripts/seed-losses.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // 1. Find user by email
  console.log('Looking up helmterminal@gmail.com...');
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) { console.error('Error listing users:', userError); return; }

  const user = users.find(u => u.email === 'helmterminal@gmail.com');
  if (!user) { console.error('User helmterminal@gmail.com not found'); return; }
  console.log(`Found user: ${user.id}\n`);

  // 2. Find a brokerage account for this user
  const { data: accounts } = await supabase
    .from('linked_accounts')
    .select('id, account_name, account_type')
    .eq('user_id', user.id)
    .in('account_type', ['brokerage', 'crypto']);

  if (!accounts || accounts.length === 0) {
    console.error('No brokerage/crypto accounts found. Creating one...');
    // Get any institution
    const { data: inst } = await supabase.from('institutions').select('id').limit(1);
    if (!inst || inst.length === 0) { console.error('No institutions found'); return; }

    const { data: newAccount, error: accErr } = await supabase
      .from('linked_accounts')
      .insert({
        user_id: user.id,
        institution_id: inst[0].id,
        account_name: 'Brokerage',
        account_type: 'brokerage',
        current_balance: 50000,
        sync_status: 'healthy',
        is_active: true,
      })
      .select()
      .single();

    if (accErr) { console.error('Error creating account:', accErr); return; }
    accounts.push(newAccount);
  }

  const brokerageAccount = accounts.find(a => a.account_type === 'brokerage') || accounts[0];
  console.log(`Using account: ${brokerageAccount.account_name} (${brokerageAccount.id})\n`);

  // 3. Upsert securities (includes some that will be losers)
  console.log('Upserting securities...');
  const securities = [
    // Losers
    { ticker: 'INTC', security_name: 'Intel Corporation', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 22.50 },
    { ticker: 'PFE', security_name: 'Pfizer Inc.', asset_class: 'equity', sector: 'Healthcare', exchange: 'NYSE', current_price: 25.80 },
    { ticker: 'BA', security_name: 'Boeing Company', asset_class: 'equity', sector: 'Industrial', exchange: 'NYSE', current_price: 155.20 },
    { ticker: 'NKE', security_name: 'Nike Inc.', asset_class: 'equity', sector: 'Consumer', exchange: 'NYSE', current_price: 71.40 },
    { ticker: 'PYPL', security_name: 'PayPal Holdings Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 68.30 },
    { ticker: 'DIS', security_name: 'Walt Disney Company', asset_class: 'equity', sector: 'Communication Services', exchange: 'NYSE', current_price: 95.60 },
    // Winners (for balance)
    { ticker: 'NVDA', security_name: 'NVIDIA Corporation', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 875.00 },
    { ticker: 'AAPL', security_name: 'Apple Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 210.50 },
    { ticker: 'MSFT', security_name: 'Microsoft Corporation', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 430.20 },
    { ticker: 'GOOGL', security_name: 'Alphabet Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 178.90 },
    { ticker: 'AMZN', security_name: 'Amazon.com Inc.', asset_class: 'equity', sector: 'Technology', exchange: 'NASDAQ', current_price: 195.40 },
    { ticker: 'JPM', security_name: 'JPMorgan Chase & Co.', asset_class: 'equity', sector: 'Financial', exchange: 'NYSE', current_price: 245.80 },
    { ticker: 'SPY', security_name: 'SPDR S&P 500 ETF', asset_class: 'etf', sector: 'Diversified', exchange: 'NYSE', current_price: 565.20 },
    { ticker: 'V', security_name: 'Visa Inc.', asset_class: 'equity', sector: 'Financial', exchange: 'NYSE', current_price: 305.40 },
  ];

  const { data: secData, error: secError } = await supabase
    .from('securities')
    .upsert(securities.map(s => ({ ...s, last_updated_at: new Date().toISOString() })), { onConflict: 'ticker' })
    .select();

  if (secError) { console.error('Error upserting securities:', secError); return; }
  console.log(`Upserted ${secData.length} securities\n`);

  const secMap = new Map(secData.map(s => [s.ticker, s.id]));

  // 4. Delete existing holdings for this user to start fresh
  console.log('Clearing existing holdings...');
  await supabase.from('holdings').delete().eq('user_id', user.id);

  // 5. Insert holdings — mix of winners and losers
  console.log('Inserting holdings...');
  const holdings = [
    // WINNERS
    { ticker: 'NVDA', shares: 25, avgCost: 450.00, currentPrice: 875.00 },    // +94.4%, +$10,625
    { ticker: 'AAPL', shares: 80, avgCost: 155.00, currentPrice: 210.50 },    // +35.8%, +$4,440
    { ticker: 'MSFT', shares: 30, avgCost: 310.00, currentPrice: 430.20 },    // +38.8%, +$3,606
    { ticker: 'GOOGL', shares: 50, avgCost: 125.00, currentPrice: 178.90 },   // +43.1%, +$2,695
    { ticker: 'AMZN', shares: 40, avgCost: 145.00, currentPrice: 195.40 },    // +34.8%, +$2,016
    { ticker: 'JPM', shares: 35, avgCost: 175.00, currentPrice: 245.80 },     // +40.5%, +$2,478
    { ticker: 'SPY', shares: 50, avgCost: 480.00, currentPrice: 565.20 },     // +17.8%, +$4,260
    { ticker: 'V', shares: 25, avgCost: 260.00, currentPrice: 305.40 },       // +17.5%, +$1,135

    // LOSERS
    { ticker: 'INTC', shares: 150, avgCost: 42.00, currentPrice: 22.50 },     // -46.4%, -$2,925
    { ticker: 'PFE', shares: 200, avgCost: 45.00, currentPrice: 25.80 },      // -42.7%, -$3,840
    { ticker: 'BA', shares: 20, avgCost: 225.00, currentPrice: 155.20 },      // -31.0%, -$1,396
    { ticker: 'NKE', shares: 60, avgCost: 115.00, currentPrice: 71.40 },      // -37.9%, -$2,616
    { ticker: 'PYPL', shares: 80, avgCost: 105.00, currentPrice: 68.30 },     // -35.0%, -$2,936
    { ticker: 'DIS', shares: 45, avgCost: 140.00, currentPrice: 95.60 },      // -31.7%, -$1,998
  ];

  // Compute total portfolio value for allocation percentages
  const totalValue = holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0);

  const holdingRows = holdings.map(h => {
    const value = h.shares * h.currentPrice;
    const costBasis = h.shares * h.avgCost;
    const gl = value - costBasis;
    const glPct = costBasis > 0 ? gl / costBasis : 0;

    return {
      user_id: user.id,
      account_id: brokerageAccount.id,
      security_id: secMap.get(h.ticker),
      ticker: h.ticker,
      shares: h.shares,
      average_cost_basis: h.avgCost,
      total_cost_basis: costBasis,
      current_price: h.currentPrice,
      total_value: value,
      unrealised_gain_loss: gl,
      unrealised_gain_loss_pct: glPct,
      day_change_pct: (Math.random() - 0.5) * 4, // random daily change
      portfolio_allocation_pct: (value / totalValue) * 100,
      last_updated_at: new Date().toISOString(),
    };
  });

  const { error: holdError } = await supabase.from('holdings').insert(holdingRows);
  if (holdError) { console.error('Error inserting holdings:', holdError); return; }
  console.log(`Inserted ${holdingRows.length} holdings (${holdings.filter(h => h.currentPrice < h.avgCost).length} losers)\n`);

  // 6. Add some realized capital gains/losses
  console.log('Inserting realized capital gains...');
  const capitalGains = [
    // A realized short-term loss
    {
      user_id: user.id,
      security_id: secMap.get('INTC'),
      ticker: 'INTC',
      transaction_type: 'sell',
      transaction_date: '2026-02-10',
      shares: 50,
      price_per_share: 24.50,
      cost_basis: 2100.00,  // bought at $42
      proceeds: 1225.00,
      gain_loss: -875.00,
      gain_loss_type: 'short_term',
      tax_year: 2026,
    },
    // A realized long-term gain
    {
      user_id: user.id,
      security_id: secMap.get('AAPL'),
      ticker: 'AAPL',
      transaction_type: 'sell',
      transaction_date: '2026-01-15',
      shares: 20,
      price_per_share: 205.00,
      cost_basis: 2800.00,  // bought at $140
      proceeds: 4100.00,
      gain_loss: 1300.00,
      gain_loss_type: 'long_term',
      tax_year: 2026,
    },
    // A realized short-term gain
    {
      user_id: user.id,
      security_id: secMap.get('NVDA'),
      ticker: 'NVDA',
      transaction_type: 'sell',
      transaction_date: '2026-02-28',
      shares: 10,
      price_per_share: 860.00,
      cost_basis: 5500.00,  // bought at $550
      proceeds: 8600.00,
      gain_loss: 3100.00,
      gain_loss_type: 'short_term',
      tax_year: 2026,
    },
    // A realized long-term loss
    {
      user_id: user.id,
      security_id: secMap.get('PFE'),
      ticker: 'PFE',
      transaction_type: 'sell',
      transaction_date: '2026-03-05',
      shares: 100,
      price_per_share: 26.50,
      cost_basis: 4800.00,  // bought at $48
      proceeds: 2650.00,
      gain_loss: -2150.00,
      gain_loss_type: 'long_term',
      tax_year: 2026,
    },
  ];

  // Clear existing capital gains for this user this year
  await supabase.from('capital_gains').delete().eq('user_id', user.id).eq('tax_year', 2026);

  const { error: cgError } = await supabase.from('capital_gains').insert(capitalGains);
  if (cgError) { console.error('Error inserting capital gains:', cgError); return; }
  console.log(`Inserted ${capitalGains.length} realized transactions\n`);

  // Summary
  const winners = holdings.filter(h => h.currentPrice >= h.avgCost);
  const losers = holdings.filter(h => h.currentPrice < h.avgCost);
  const totalGL = holdingRows.reduce((s, h) => s + (h.unrealised_gain_loss ?? 0), 0);
  const totalGains = holdingRows.filter(h => (h.unrealised_gain_loss ?? 0) > 0).reduce((s, h) => s + (h.unrealised_gain_loss ?? 0), 0);
  const totalLosses = holdingRows.filter(h => (h.unrealised_gain_loss ?? 0) < 0).reduce((s, h) => s + (h.unrealised_gain_loss ?? 0), 0);

  console.log('=== Portfolio Summary ===');
  console.log(`Total value: $${totalValue.toLocaleString()}`);
  console.log(`Winners: ${winners.length} positions (+$${totalGains.toLocaleString()})`);
  console.log(`Losers: ${losers.length} positions ($${totalLosses.toLocaleString()})`);
  console.log(`Net unrealized: $${totalGL.toLocaleString()}`);
  console.log(`\nRealized gains YTD: $${(1300 + 3100).toLocaleString()}`);
  console.log(`Realized losses YTD: $${(-875 + -2150).toLocaleString()}`);
  console.log('\nDone!');
}

main().catch(console.error);
