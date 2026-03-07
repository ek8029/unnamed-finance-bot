import { TaxIntelligence } from '@/components/dashboard/tax-intelligence';
import { mockTaxIntelligence } from '@/lib/mock-data';
import { FileText, TrendingDown, Calendar, Lightbulb, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TaxesPage() {
  const totalTaxLiability =
    mockTaxIntelligence.estimated_income_tax +
    mockTaxIntelligence.short_term_capital_gains +
    mockTaxIntelligence.long_term_capital_gains -
    mockTaxIntelligence.deductions_identified;

  const potentialSavings = mockTaxIntelligence.optimization_suggestions.reduce((sum, suggestion) => {
    const match = suggestion.match(/\$([0-9,]+)/);
    return match ? sum + parseInt(match[1].replace(',', '')) : sum;
  }, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Tax Intelligence</h1>
        <p className="text-gray-600">
          AI-powered tax planning and optimization recommendations
        </p>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <CardDescription>Estimated Tax Liability</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl text-red-600">
              ${totalTaxLiability.toLocaleString()}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">For tax year 2024</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-green-600" />
              <CardDescription>Potential Savings</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl text-green-600">
              ${potentialSavings.toLocaleString()}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">Through optimization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <CardDescription>Next Quarterly Payment</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl">
              ${mockTaxIntelligence.estimated_quarterly_payment.toLocaleString()}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">Due April 15, 2024</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              <CardDescription>Optimization Ideas</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl">
              {mockTaxIntelligence.optimization_suggestions.length}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">Available strategies</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Tax Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tax Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>2024 Tax Breakdown</CardTitle>
              <CardDescription>Estimated tax liability by category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Estimated Income Tax</p>
                    <p className="text-sm text-gray-600">Federal and state income tax</p>
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    ${mockTaxIntelligence.estimated_income_tax.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Short-Term Capital Gains</p>
                    <p className="text-sm text-gray-600">Taxed as ordinary income</p>
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    ${mockTaxIntelligence.short_term_capital_gains.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Long-Term Capital Gains</p>
                    <p className="text-sm text-gray-600">Preferential tax rate applies</p>
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    ${mockTaxIntelligence.long_term_capital_gains.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <div>
                    <p className="font-medium text-green-900">Identified Deductions</p>
                    <p className="text-sm text-green-700">Reduces taxable income</p>
                  </div>
                  <span className="text-xl font-bold text-green-600">
                    -${mockTaxIntelligence.deductions_identified.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total Estimated Liability</span>
                  <span className="text-2xl font-bold text-red-600">
                    ${totalTaxLiability.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Optimization Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Optimization Strategies</CardTitle>
              <CardDescription>AI-identified opportunities to reduce your tax burden</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockTaxIntelligence.optimization_suggestions.map((suggestion, index) => {
                const savingsMatch = suggestion.match(/\$([0-9,]+)/);
                const savings = savingsMatch ? parseInt(savingsMatch[1].replace(',', '')) : 0;

                return (
                  <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-blue-600" />
                          <Badge variant="outline" className="text-xs">
                            Strategy {index + 1}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-900">{suggestion.split(' - ')[0]}</p>
                      </div>
                      {savings > 0 && (
                        <div className="ml-4 text-right">
                          <p className="text-lg font-bold text-green-600">${savings.toLocaleString()}</p>
                          <p className="text-xs text-gray-600">potential savings</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tax Intelligence Widget */}
        <div className="space-y-6">
          <TaxIntelligence taxData={mockTaxIntelligence} />

          {/* Quarterly Payment Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2024 Quarterly Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { quarter: 'Q1 2024', date: 'April 15, 2024', status: 'Due Soon', color: 'red' },
                { quarter: 'Q2 2024', date: 'June 17, 2024', status: 'Upcoming', color: 'yellow' },
                { quarter: 'Q3 2024', date: 'September 16, 2024', status: 'Upcoming', color: 'gray' },
                { quarter: 'Q4 2024', date: 'January 15, 2025', status: 'Upcoming', color: 'gray' },
              ].map((payment) => (
                <div key={payment.quarter} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{payment.quarter}</p>
                    <p className="text-xs text-gray-600">{payment.date}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      payment.color === 'red'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : payment.color === 'yellow'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tax Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tax Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {['Form 1099-B', 'Form 1099-DIV', 'Form 1099-INT', 'W-2 Form'].map((doc) => (
                <div key={doc} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">{doc}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">Ready</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
