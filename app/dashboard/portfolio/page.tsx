import { PortfolioMonitor } from '@/components/dashboard/portfolio-monitor';
import { PortfolioAllocation } from '@/components/dashboard/portfolio-allocation';
import { mockHoldings, mockPortfolioAllocation, mockFinancialSummary } from '@/lib/mock-data';
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PortfolioPage() {
  const totalValue = mockHoldings.reduce((sum, holding) => sum + holding.total_value, 0);
  const totalDayChange = mockHoldings.reduce(
    (sum, holding) => sum + (holding.total_value * holding.day_change_percentage) / 100,
    0
  );
  const dayChangePercentage = (totalDayChange / totalValue) * 100;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Portfolio</h1>
        <p className="text-gray-600">
          Track your investments, allocation, and performance
        </p>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-gray-600" />
              <CardDescription>Total Portfolio Value</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">{mockHoldings.length} holdings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              {dayChangePercentage >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <CardDescription>Today's Change</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className={`text-3xl ${dayChangePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dayChangePercentage >= 0 ? '+' : ''}
              {dayChangePercentage.toFixed(2)}%
            </CardTitle>
            <p className={`text-sm mt-1 ${dayChangePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dayChangePercentage >= 0 ? '+' : ''}
              ${totalDayChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-gray-600" />
              <CardDescription>Largest Position</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-xl">
              {mockHoldings.sort((a, b) => b.portfolio_allocation - a.portfolio_allocation)[0]?.ticker}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {mockHoldings.sort((a, b) => b.portfolio_allocation - a.portfolio_allocation)[0]?.portfolio_allocation}% of portfolio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              <CardDescription>Best Performer Today</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-xl text-green-600">
              {mockHoldings.sort((a, b) => b.day_change_percentage - a.day_change_percentage)[0]?.ticker}
            </CardTitle>
            <p className="text-sm text-green-600 mt-1">
              +{mockHoldings.sort((a, b) => b.day_change_percentage - a.day_change_percentage)[0]?.day_change_percentage}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Holdings Table */}
        <div className="lg:col-span-2">
          <PortfolioMonitor holdings={mockHoldings} />
        </div>

        {/* Right Column - Allocation Chart */}
        <div className="space-y-6">
          <PortfolioAllocation allocation={mockPortfolioAllocation} />

          {/* Asset Class Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asset Class Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: 'Equities', value: 262958.5, percentage: 82.6 },
                { name: 'ETFs', value: 100684, percentage: 31.7 },
                { name: 'Crypto', value: 44105, percentage: 13.9 },
              ].map((asset) => (
                <div key={asset.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{asset.name}</span>
                    <span className="font-medium text-gray-900">{asset.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                      style={{ width: `${asset.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    ${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">1 Month Return</span>
                <span className="text-sm font-medium text-green-600">+5.2%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">3 Month Return</span>
                <span className="text-sm font-medium text-green-600">+12.8%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">YTD Return</span>
                <span className="text-sm font-medium text-green-600">+18.3%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sharpe Ratio</span>
                <span className="text-sm font-medium text-gray-900">1.42</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Beta</span>
                <span className="text-sm font-medium text-gray-900">1.15</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
