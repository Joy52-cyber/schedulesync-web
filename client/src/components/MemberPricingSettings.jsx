import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Save, Loader2, AlertCircle, Sparkles, TrendingUp, CheckCircle2, Info } from 'lucide-react';
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
      
      setSuccessMessage('Pricing settings saved successfully!');
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
  ];

  const selectedCurrency = currencies.find(c => c.code === settings.currency) || currencies[0];

  const calculateFees = () => {
    const stripeFee = settings.booking_price * 0.029 + 0.30;
    const netAmount = settings.booking_price - stripeFee;
    return { stripeFee, netAmount };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const { stripeFee, netAmount } = calculateFees();

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800 font-semibold">{successMessage}</p>
        </div>
      )}

      {/* Payment Toggle - Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 rounded-2xl p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-24 -mb-24"></div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Payment Settings</h3>
                <p className="text-green-100 text-sm mt-1">Monetize your time with instant payments</p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.payment_required}
                onChange={(e) => setSettings({ ...settings, payment_required: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-16 h-9 bg-white bg-opacity-20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-white peer-focus:ring-opacity-30 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-white peer-checked:bg-opacity-30"></div>
            </label>
          </div>

          {settings.payment_required && (
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4 border border-white border-opacity-20">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">Payment Required</span>
                <span className="ml-auto text-green-100">Guests will pay before booking</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Configuration - Only shown if payment required */}
      {settings.payment_required && (
        <div className="space-y-6 animate-slide-down">
          {/* Currency & Price Card */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <h4 className="font-bold text-gray-900">Set Your Rate</h4>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Currency Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Currency
                </label>
                <div className="relative">
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none appearance-none bg-white cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    {currencies.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.flag} {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">
                    {selectedCurrency.flag}
                  </span>
                </div>
              </div>

              {/* Price Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Booking Price per Session
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-2xl">
                    {selectedCurrency.symbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.booking_price}
                    onChange={(e) => setSettings({ ...settings, booking_price: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-16 pr-6 py-5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-3xl font-bold text-gray-900 hover:border-gray-300 transition-colors"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                  <Info className="h-4 w-4" />
                  <span>Set your hourly or per-session rate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fee Breakdown - Only show if price > 0 */}
          {settings.booking_price > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 overflow-hidden shadow-lg animate-fade-in">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
                <div className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5" />
                  <h4 className="font-bold">Revenue Breakdown</h4>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {/* Booking Price */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-blue-100">
                    <span className="text-gray-700 font-medium">Booking Price</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {selectedCurrency.symbol}{settings.booking_price.toFixed(2)}
                    </span>
                  </div>

                  {/* Stripe Fee */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-blue-100">
                    <div>
                      <span className="text-gray-700 font-medium">Stripe Fee</span>
                      <p className="text-xs text-gray-500 mt-1">2.9% + {selectedCurrency.symbol}0.30</p>
                    </div>
                    <span className="text-xl font-semibold text-red-600">
                      -{selectedCurrency.symbol}{stripeFee.toFixed(2)}
                    </span>
                  </div>

                  {/* Net Amount */}
                  <div className="flex items-center justify-between p-5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white shadow-lg">
                    <div>
                      <span className="font-bold text-lg">You Receive</span>
                      <p className="text-xs text-green-100 mt-1">After fees</p>
                    </div>
                    <span className="text-3xl font-bold">
                      {selectedCurrency.symbol}{netAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Info Box */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">Payment Processing</p>
                      <p className="text-blue-700 text-xs leading-relaxed">
                        Payments are processed securely through Stripe. Funds are typically available in your account within 2-7 business days.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="sticky bottom-4 z-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white px-8 py-5 rounded-xl hover:shadow-2xl hover:scale-[1.02] transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
        >
          {saving ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="h-6 w-6" />
              Save Pricing Settings
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