/**
 * Seed Institutions
 * Populates the institutions table with major financial institutions
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

const institutions = [
  // Banks
  {
    name: 'Chase',
    slug: 'chase',
    institution_type: 'bank',
    website_url: 'https://www.chase.com',
    supports_plaid: true,
    plaid_institution_id: 'ins_3', // Example Plaid ID
  },
  {
    name: 'Bank of America',
    slug: 'bank-of-america',
    institution_type: 'bank',
    website_url: 'https://www.bankofamerica.com',
    supports_plaid: true,
    plaid_institution_id: 'ins_4',
  },
  {
    name: 'Wells Fargo',
    slug: 'wells-fargo',
    institution_type: 'bank',
    website_url: 'https://www.wellsfargo.com',
    supports_plaid: true,
    plaid_institution_id: 'ins_5',
  },
  {
    name: 'Citi',
    slug: 'citi',
    institution_type: 'bank',
    website_url: 'https://www.citi.com',
    supports_plaid: true,
    plaid_institution_id: 'ins_6',
  },
  {
    name: 'Capital One',
    slug: 'capital-one',
    institution_type: 'bank',
    website_url: 'https://www.capitalone.com',
    supports_plaid: true,
    plaid_institution_id: 'ins_127989',
  },

  // Credit Cards
  {
    name: 'American Express',
    slug: 'amex',
    institution_type: 'bank',
    website_url: 'https://www.americanexpress.com',
    supports_plaid: true,
    plaid_institution_id: 'ins_7',
  },
  {
    name: 'Discover',
    slug: 'discover',
    institution_type: 'bank',
    website_url: 'https://www.discover.com',
    supports_plaid: true,
    plaid_institution_id: 'ins_8',
  },

  // Brokerages
  {
    name: 'Fidelity Investments',
    slug: 'fidelity',
    institution_type: 'brokerage',
    website_url: 'https://www.fidelity.com',
    supports_plaid: true,
    supports_snaptrade: true,
    plaid_institution_id: 'ins_9',
  },
  {
    name: 'Charles Schwab',
    slug: 'schwab',
    institution_type: 'brokerage',
    website_url: 'https://www.schwab.com',
    supports_plaid: true,
    supports_snaptrade: true,
    plaid_institution_id: 'ins_10',
  },
  {
    name: 'Vanguard',
    slug: 'vanguard',
    institution_type: 'brokerage',
    website_url: 'https://www.vanguard.com',
    supports_plaid: true,
    supports_snaptrade: true,
    plaid_institution_id: 'ins_11',
  },
  {
    name: 'Robinhood',
    slug: 'robinhood',
    institution_type: 'brokerage',
    website_url: 'https://www.robinhood.com',
    supports_plaid: true,
    supports_snaptrade: true,
    plaid_institution_id: 'ins_116527',
  },
  {
    name: 'E*TRADE',
    slug: 'etrade',
    institution_type: 'brokerage',
    website_url: 'https://www.etrade.com',
    supports_plaid: true,
    supports_snaptrade: true,
    plaid_institution_id: 'ins_12',
  },
  {
    name: 'TD Ameritrade',
    slug: 'td-ameritrade',
    institution_type: 'brokerage',
    website_url: 'https://www.tdameritrade.com',
    supports_plaid: true,
    supports_snaptrade: true,
    plaid_institution_id: 'ins_13',
  },

  // Crypto Exchanges
  {
    name: 'Coinbase',
    slug: 'coinbase',
    institution_type: 'crypto_exchange',
    website_url: 'https://www.coinbase.com',
    supports_plaid: true,
    plaid_institution_id: 'ins_115616',
  },
  {
    name: 'Kraken',
    slug: 'kraken',
    institution_type: 'crypto_exchange',
    website_url: 'https://www.kraken.com',
    supports_plaid: false,
  },
  {
    name: 'Gemini',
    slug: 'gemini',
    institution_type: 'crypto_exchange',
    website_url: 'https://www.gemini.com',
    supports_plaid: false,
  },
];

async function seedInstitutions() {
  console.log('🌱 Seeding institutions...');

  try {
    const { data, error } = await supabase
      .from('institutions')
      .upsert(institutions, { onConflict: 'slug', ignoreDuplicates: false });

    if (error) {
      console.error('❌ Error seeding institutions:', error);
      return;
    }

    console.log(`✅ Successfully seeded ${institutions.length} institutions`);
    console.log('📊 Institutions added:');
    institutions.forEach((inst) => {
      console.log(`   - ${inst.name} (${inst.institution_type})`);
    });
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

seedInstitutions();
