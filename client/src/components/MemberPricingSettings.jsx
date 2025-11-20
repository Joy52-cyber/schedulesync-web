import { useState, useEffect } from 'react';
import { 
  DollarSign, CreditCard, Save, Loader2, AlertCircle, Sparkles, 
  TrendingUp, CheckCircle2, Info, Settings, Shield, Clock
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
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
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

      {/* Main Settings Card */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5">
          <div className="flex items-center gap-3 text-white">
            <Settings className="h-6 w-6" />
            <div>
              <h3 className="text-xl font-bold">Pricing Configuration</h3>
              <p className="text-blue-100 text-sm mt-1">Set up payment requirements for bookings</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Payment Toggle */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CreditCard className="h-6 w-6 text-green-600 mt-1" />
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Require Payment for Bookings</h4>
                  <p className="text-sm text-gray-700">
                    When enabled, guests must complete payment before confirming their booking
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.payment_required}
                  onChange={(e) => setSettings({ ...settings, payment_required: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>

          {/* Pricing Section - Show when payment required */}
          {settings.payment_required && (
            <div className="space-y-5 animate-slide-down">
              {/* Currency Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Currency
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-base"
                >
                  {currencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Session Price
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold text-xl">
                    {selectedCurrency.symbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.booking_price}
                    onChange={(e) => setSettings({ ...settings, booking_price: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-2xl font-bold text-gray-900"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Amount charged per booking session
                </p>
              </div>

              {/* Payment Info */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Secure Payment Processing</p>
                    <ul className="space-y-1 text-blue-800">
                      <li>✓ Powered by Stripe - Industry-leading security</li>
                      <li>✓ PCI DSS compliant payment processing</li>
                      <li>✓ Automatic receipt generation</li>
                      <li>✓ Supports all major credit cards</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Revenue Breakdown */}
              {settings.booking_price > 0 && (
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border-2 border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-700 to-slate-700 px-5 py-3">
                    <div className="flex items-center gap-2 text-white">
                      <TrendingUp className="h-5 w-5" />
                      <h4 className="font-bold">Revenue Breakdown</h4>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-3">
                    {/* Booking Price */}
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                      <span className="text-gray-700 font-medium">Guest Payment</span>
                      <span className="text-xl font-bold text-gray-900">
                        {selectedCurrency.symbol}{settings.booking_price.toFixed(2)}
                      </span>
                    </div>

                    {/* Processing Fee */}
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                      <div>
                        <span className="text-gray-700 font-medium">Stripe Fee</span>
                        <p className="text-xs text-gray-500 mt-0.5">2.9% + {selectedCurrency.symbol}0.30</p>
                      </div>
                      <span className="text-lg font-semibold text-red-600">
                        -{selectedCurrency.symbol}{stripeFee.toFixed(2)}
                      </span>
                    </div>

                    {/* Net Revenue */}
                    <div className="flex items-center justify-between p-5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-white">
                      <div>
                        <span className="font-bold text-lg">You Receive</span>
                        <p className="text-xs text-green-100 mt-1">Per booking</p>
                      </div>
                      <span className="text-2xl font-black">
                        {selectedCurrency.symbol}{netAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Policy Info */}
      {settings.payment_required && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-2">Payment & Refund Policy</p>
              <ul className="space-y-1 text-amber-800">
                <li>• Payment is collected immediately when guest confirms booking</li>
                <li>• Funds are available in your account within 2-7 business days</li>
                <li>• Cancellations can be processed with full or partial refunds</li>
                <li>• All transactions are logged and receipts are automatically sent</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {saving ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-5 w-5" />
            Save Pricing Settings
          </>
        )}
      </button>

      <style jsx>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
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
          animation: slide-down 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}