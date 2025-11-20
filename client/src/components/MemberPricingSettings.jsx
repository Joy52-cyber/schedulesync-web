import { useState, useEffect } from 'react';
import { 
  DollarSign, CreditCard, Save, Loader2, AlertCircle, Sparkles, 
  TrendingUp, CheckCircle2, Info, Clock, Zap, Package, Percent,
  Eye, Edit3, Trash2, Plus
} from 'lucide-react';
import api from '../utils/api';

export default function MemberPricingSettings({ teamId, memberId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    booking_price: 0,
    currency: 'USD',
    payment_required: false,
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [pricingMode, setPricingMode] = useState('simple'); // 'simple' or 'advanced'
  const [advancedPricing, setAdvancedPricing] = useState({
    sessionDuration: 60,
    enableHourlyRate: false,
    hourlyRate: 0,
    enablePackages: false,
    packages: [],
  });

  useEffect(() => {
    loadSettings();
  }, [memberId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/teams/${teamId}/members`);
      const member = response.data.members.find(m => m.id === parseInt(memberId));
      
      if (member) {
        setSettings({
          booking_price: member.booking_price || 0,
          currency: member.currency || 'USD',
          payment_required: member.payment_required || false,
        });
      }
    } catch (error) {
      console.error('Error loading pricing settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/teams/${teamId}/members/${memberId}/pricing`, settings);
      
      setSuccessMessage('💰 Pricing settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving pricing settings:', error);
      alert('Failed to save pricing settings');
    } finally {
      setSaving(false);
    }
  };

  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
    { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
    { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won', flag: '🇰🇷' },
    { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  ];

  const selectedCurrency = currencies.find(c => c.code === settings.currency) || currencies[0];

  const calculateFees = (amount) => {
    const stripeFee = amount * 0.029 + 0.30;
    const netAmount = amount - stripeFee;
    const feePercentage = (stripeFee / amount) * 100;
    return { stripeFee, netAmount, feePercentage };
  };

  const pricingPresets = [
    { label: 'Consultation', price: 50, duration: 30, icon: '💬' },
    { label: 'Standard Session', price: 100, duration: 60, icon: '⏰' },
    { label: 'Extended Session', price: 200, duration: 120, icon: '📅' },
    { label: 'Workshop', price: 500, duration: 240, icon: '🎓' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const { stripeFee, netAmount, feePercentage } = calculateFees(settings.booking_price);

  return (
    <div className="space-y-6 pb-24">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 flex items-center gap-3 animate-fade-in shadow-lg">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-white" />
          </div>
          <p className="text-green-800 font-bold text-lg">{successMessage}</p>
        </div>
      )}

      {/* Payment Toggle - Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 rounded-3xl p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl flex items-center justify-center shadow-lg">
                <CreditCard className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-3xl font-black mb-1">Payment Settings</h3>
                <p className="text-green-100 text-base">Monetize your expertise with secure payments</p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.payment_required}
                onChange={(e) => setSettings({ ...settings, payment_required: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-20 h-10 bg-white bg-opacity-20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-white peer-focus:ring-opacity-30 rounded-full peer peer-checked:after:translate-x-10 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-9 after:w-9 after:transition-all peer-checked:bg-white peer-checked:bg-opacity-30 shadow-lg group-hover:scale-105 transition-transform"></div>
              <span className="ml-3 text-sm font-bold opacity-75 group-hover:opacity-100 transition-opacity">
                {settings.payment_required ? 'ENABLED' : 'DISABLED'}
              </span>
            </label>
          </div>

          {settings.payment_required && (
            <div className="bg-white bg-opacity-15 backdrop-blur-lg rounded-2xl p-5 border-2 border-white border-opacity-30 shadow-xl">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-yellow-300" />
                <span className="font-bold text-lg">Payment Required Mode Active</span>
                <span className="ml-auto px-4 py-2 bg-white bg-opacity-20 rounded-full text-sm font-bold">
                  🔒 Secure Checkout
                </span>
              </div>
            </div>
          )}

          {!settings.payment_required && (
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-5 border border-white border-opacity-20">
              <p className="text-green-100 text-center">
                ℹ️ Enable payment requirement to start accepting bookings with payment
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Configuration */}
      {settings.payment_required && (
        <div className="space-y-6 animate-slide-down">
          {/* Pricing Mode Tabs */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPricingMode('simple')}
                className={`px-6 py-4 rounded-xl font-bold transition-all ${
                  pricingMode === 'simple'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Zap className="h-5 w-5 inline mr-2" />
                Simple Pricing
              </button>
              <button
                onClick={() => setPricingMode('advanced')}
                className={`px-6 py-4 rounded-xl font-bold transition-all ${
                  pricingMode === 'advanced'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Package className="h-5 w-5 inline mr-2" />
                Advanced Options
              </button>
            </div>
          </div>

          {/* Simple Pricing */}
          {pricingMode === 'simple' && (
            <div className="space-y-6">
              {/* Quick Presets */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Quick Start Presets
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {pricingPresets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setSettings({ ...settings, booking_price: preset.price })}
                      className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all text-left group"
                    >
                      <div className="text-3xl mb-2">{preset.icon}</div>
                      <div className="font-bold text-gray-900 mb-1">{preset.label}</div>
                      <div className="text-sm text-gray-600 mb-2">{preset.duration} minutes</div>
                      <div className="text-2xl font-black text-purple-600">
                        {selectedCurrency.symbol}{preset.price}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency & Price */}
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5">
                  <div className="flex items-center gap-3 text-white">
                    <DollarSign className="h-6 w-6" />
                    <h4 className="font-black text-xl">Set Your Session Rate</h4>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  {/* Currency Selector */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      💱 Currency
                    </label>
                    <div className="relative">
                      <select
                        value={settings.currency}
                        onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                        className="w-full pl-16 pr-6 py-5 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none appearance-none bg-white cursor-pointer hover:border-blue-400 transition-all font-semibold shadow-sm"
                      >
                        {currencies.map(currency => (
                          <option key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                          </option>
                        ))}
                      </select>
                      <span className="absolute left-5 top-1/2 transform -translate-y-1/2 text-3xl pointer-events-none">
                        {selectedCurrency.flag}
                      </span>
                    </div>
                  </div>

                  {/* Price Input - Large */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      💰 Price Per Session
                    </label>
                    <div className="relative group">
                      <span className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 font-black text-4xl group-focus-within:text-blue-600 transition-colors">
                        {selectedCurrency.symbol}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settings.booking_price}
                        onChange={(e) => setSettings({ ...settings, booking_price: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-20 pr-8 py-8 border-3 border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none text-5xl font-black text-gray-900 hover:border-blue-400 transition-all shadow-lg"
                        placeholder="0.00"
                      />
                      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 flex flex-col items-end">
                        <button
                          onClick={() => setSettings({ ...settings, booking_price: settings.booking_price + 10 })}
                          className="w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-lg flex items-center justify-center text-blue-600 font-bold transition-colors"
                        >
                          +
                        </button>
                        <button
                          onClick={() => setSettings({ ...settings, booking_price: Math.max(0, settings.booking_price - 10) })}
                          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 font-bold transition-colors mt-1"
                        >
                          −
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-sm text-gray-600 bg-blue-50 px-4 py-3 rounded-xl">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span>This is the amount guests will pay to book a session with you</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Pricing */}
          {pricingMode === 'advanced' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-amber-900 mb-2">Advanced Features Coming Soon!</h4>
                    <p className="text-amber-800 text-sm">
                      Hourly rates, package deals, and custom duration pricing will be available in the next update.
                      For now, use Simple Pricing to set your rate.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Breakdown */}
          {settings.booking_price > 0 && (
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl border-3 border-blue-200 overflow-hidden shadow-2xl animate-fade-in">
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-5">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-7 w-7" />
                    <h4 className="font-black text-2xl">Revenue Calculator</h4>
                  </div>
                  <Eye className="h-6 w-6 opacity-75" />
                </div>
              </div>
              
              <div className="p-8">
                <div className="space-y-5">
                  {/* Guest Pays */}
                  <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-10 rounded-2xl"></div>
                    <div className="relative flex items-center justify-between p-6 bg-white rounded-2xl border-2 border-blue-200 shadow-lg">
                      <div>
                        <span className="text-gray-600 font-medium block mb-1">Guest Pays</span>
                        <span className="text-sm text-gray-500">Full booking amount</span>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black text-gray-900">
                          {selectedCurrency.symbol}{settings.booking_price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Processing Fee */}
                  <div className="flex items-center justify-between p-6 bg-white rounded-2xl border-2 border-red-200 shadow-md">
                    <div>
                      <span className="text-gray-700 font-bold block mb-1">Stripe Processing Fee</span>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">
                          {feePercentage.toFixed(1)}%
                        </span>
                        <span>2.9% + {selectedCurrency.symbol}0.30</span>
                      </div>
                    </div>
                    <span className="text-3xl font-black text-red-600">
                      -{selectedCurrency.symbol}{stripeFee.toFixed(2)}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t-2 border-dashed border-gray-300 my-4"></div>

                  {/* You Receive */}
                  <div className="relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-2xl"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl group-hover:scale-105 transition-transform"></div>
                    <div className="relative flex items-center justify-between p-8 text-white">
                      <div>
                        <span className="font-black text-2xl block mb-2">💰 You Receive</span>
                        <div className="flex items-center gap-2">
                          <span className="text-green-100 text-sm">After processing fees</span>
                          <CheckCircle2 className="h-5 w-5 text-green-100" />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-5xl font-black">
                          {selectedCurrency.symbol}{netAmount.toFixed(2)}
                        </div>
                        <div className="text-green-100 text-sm mt-1">
                          Per booking
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 mt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Info className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-bold text-gray-900 mb-2 text-lg">Payment Processing</h5>
                        <div className="space-y-2 text-sm text-gray-700">
                          <p>✓ Secure payment processing powered by Stripe</p>
                          <p>✓ Funds available in 2-7 business days</p>
                          <p>✓ PCI DSS compliant and bank-level encryption</p>
                          <p>✓ Automatic receipt generation for guests</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button - Sticky */}
      <div className="fixed bottom-6 left-0 right-0 z-50 px-4 max-w-4xl mx-auto">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white px-10 py-6 rounded-2xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all font-black text-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 shadow-2xl border-4 border-white"
        >
          {saving ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="h-7 w-7" />
              Save Pricing Settings
              <Sparkles className="h-6 w-6" />
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-down {
          animation: slide-down 0.4s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}