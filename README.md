# AI Personal CFO Platform - MVP

An AI-powered personal financial intelligence platform that acts as an autonomous financial intelligence agent for individuals.

## Overview

Unlike traditional finance apps that only track spending or budgets, this platform analyzes a user's entire financial life and generates actionable insights. The system functions like a continuous monitoring agent for the user's financial life, providing institutional-grade financial intelligence to individuals.

## Features

### Core Modules

1. **Unified Financial Dashboard**
   - Net Worth tracking with 12-month trend chart
   - Financial summary cards (Assets, Liabilities, Cash Flow, Portfolio)
   - Financial Health Score (0-100 scale)
   - Account aggregation panel

2. **AI Insights Feed**
   - Spending insights
   - Portfolio insights
   - Market intelligence
   - Tax optimization suggestions
   - Credit optimization recommendations

3. **Investment Portfolio Monitor**
   - Real-time holdings table with asset details
   - Portfolio allocation visualization
   - Day change percentages
   - Sector and asset class tracking
   - Market intelligence alerts

4. **Tax Intelligence**
   - Estimated tax exposure
   - Capital gains tracking (short-term and long-term)
   - Deductions identification
   - Quarterly payment estimates
   - Tax optimization suggestions

5. **Financial Health Score**
   - Overall score (0-100)
   - Debt-to-asset ratio
   - Savings rate
   - Emergency fund coverage
   - Portfolio diversification

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom ShadCN-inspired components
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ek8029/unnamed-finance-bot.git
cd "unnamed fintech bot"
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main dashboard page
│   └── globals.css         # Global styles
├── components/
│   ├── ui/                 # Base UI components
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   └── progress.tsx
│   └── dashboard/          # Dashboard-specific components
│       ├── net-worth-card.tsx
│       ├── financial-summary-cards.tsx
│       ├── financial-health-score.tsx
│       ├── account-aggregation.tsx
│       ├── ai-insights-feed.tsx
│       ├── portfolio-monitor.tsx
│       ├── portfolio-allocation.tsx
│       └── tax-intelligence.tsx
├── lib/
│   ├── utils.ts            # Utility functions
│   └── mock-data.ts        # Mock financial data
└── types/
    └── index.ts            # TypeScript type definitions

```

## Current Status (MVP)

The current version includes:
- ✅ Unified Financial Dashboard
- ✅ AI Insights Feed with 6 insight types
- ✅ Investment Portfolio Monitor
- ✅ Portfolio Allocation Chart
- ✅ Financial Health Score
- ✅ Account Aggregation
- ✅ Tax Intelligence
- ✅ Mock data for demonstration

## Future Enhancements

- Real financial account connections (Plaid API)
- AI-powered insight generation using LLMs
- Real-time market data integration
- Goal tracking and planning
- Investment recommendations
- Tax filing integrations
- Multi-user support with authentication
- Mobile app
- Notifications and alerts
- Export and reporting features

## Data Model

The platform uses the following core entities:

- **User**: User account information
- **Account**: Connected financial accounts
- **Transaction**: Financial transactions
- **Holding**: Investment holdings
- **Insight**: AI-generated financial insights
- **FinancialSummary**: Overall financial snapshot
- **FinancialHealthScore**: Health score metrics
- **TaxIntelligence**: Tax-related data

## Security Considerations

For production deployment, ensure:
- TLS encryption for all data transmission
- AES-256 encryption for stored financial data
- OAuth for account connections
- No storage of banking credentials
- Regular security audits
- Compliance with financial data regulations

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Contributing

This is a personal project. For bug reports or feature requests, please open an issue on GitHub.

## License

ISC

## Author

Evan Kittredge (ek8029)

## Acknowledgments

Built with Claude Code as an AI-powered personal CFO platform MVP.
