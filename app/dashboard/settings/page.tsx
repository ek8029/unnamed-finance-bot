'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Bell,
  Shield,
  Palette,
  CreditCard,
  Database,
  Mail,
  Lock,
  Smartphone,
  Globe,
} from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">
          Manage your account preferences and application settings
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <CardTitle>Profile Settings</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="John Doe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="john.doe@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="+1 (555) 123-4567"
              />
            </div>
            <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <CardTitle>Notification Preferences</CardTitle>
            </div>
            <CardDescription>Choose what you want to be notified about</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'AI Insights', description: 'Get notified of new financial insights', enabled: true },
              { label: 'Portfolio Alerts', description: 'Price movements and market events', enabled: true },
              { label: 'Tax Opportunities', description: 'Tax optimization suggestions', enabled: true },
              { label: 'Account Activity', description: 'Unusual transactions and spending', enabled: true },
              { label: 'Marketing Emails', description: 'Product updates and promotions', enabled: false },
            ].map((notification) => (
              <div key={notification.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{notification.label}</p>
                  <p className="text-xs text-gray-600">{notification.description}</p>
                </div>
                <button
                  className={`w-12 h-6 rounded-full transition-colors ${
                    notification.enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                      notification.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Protect your account and data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Lock className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-sm text-gray-900">Password</p>
                  <p className="text-xs text-gray-600">Last changed 3 months ago</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Change</Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Smartphone className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-sm text-gray-900">Two-Factor Authentication</p>
                  <p className="text-xs text-green-600">Enabled via SMS</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Manage</Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-sm text-gray-900">Active Sessions</p>
                  <p className="text-xs text-gray-600">2 active devices</p>
                </div>
              </div>
              <Button variant="outline" size="sm">View</Button>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Palette className="w-5 h-5 text-blue-600" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize how the app looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {['Light', 'Dark', 'Auto'].map((theme) => (
                  <button
                    key={theme}
                    className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                      theme === 'Light'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Dashboard Density</label>
              <div className="grid grid-cols-3 gap-3">
                {['Compact', 'Comfortable', 'Spacious'].map((density) => (
                  <button
                    key={density}
                    className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                      density === 'Comfortable'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {density}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing & Subscription */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <CardTitle>Billing & Subscription</CardTitle>
            </div>
            <CardDescription>Manage your subscription and payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">Premium Plan</p>
                  <p className="text-sm text-gray-600">$29.99/month</p>
                </div>
                <Badge className="bg-gradient-to-r from-blue-600 to-purple-600">Active</Badge>
              </div>
              <p className="text-xs text-gray-600 mb-3">Next billing date: April 15, 2024</p>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="flex-1">Change Plan</Button>
                <Button variant="outline" size="sm" className="flex-1">Cancel</Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Payment Method</p>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">•••• •••• •••• 4242</p>
                    <p className="text-xs text-gray-600">Expires 12/2026</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-600" />
              <CardTitle>Data & Privacy</CardTitle>
            </div>
            <CardDescription>Control your data and privacy settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm text-gray-900">Export Your Data</p>
                <p className="text-xs text-gray-600">Download all your financial data</p>
              </div>
              <Button variant="outline" size="sm">Export</Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm text-gray-900">Data Sharing</p>
                <p className="text-xs text-gray-600">Control third-party data access</p>
              </div>
              <Button variant="outline" size="sm">Manage</Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
              <div>
                <p className="font-medium text-sm text-red-900">Delete Account</p>
                <p className="text-xs text-red-600">Permanently delete your account and data</p>
              </div>
              <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
