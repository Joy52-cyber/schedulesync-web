import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Save, Loader2, AlertCircle } from 'lucide-react';
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
      
      setSuccessMessage('Pricing settings saved successfully! 💰');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedCurrency = currencies.find(c => c.code === settings.currency) || currencies[0];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-green-600" />
          Payment Settings
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Set pricing for bookings with this team member
        </p>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Enable Payment Toggle */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-6 w-6 text-green-600 mt-1" />
              <div>
                <h4 className="font-bold text-gray-900 mb-1">Require Payment</h4>
                <p className="text-sm text-gray-700">
                  Guests must pay before booking is confirmed
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

        {/* Pricing Section */}
        {settings.payment_required && (
          <div className="space-y-4">
            {/* Currency Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Booking Price
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold text-lg">
                  {selectedCurrency.symbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.booking_price}
                  onChange={(e) => setSettings({ ...settings, booking_price: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg font-semibold"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Stripe processes payments and charges 2.9% + $0.30 per transaction
              </p>
            </div>

            {/* Preview */}
            {settings.booking_price > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Price Preview
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Booking Price:</span>
                    <span className="font-bold text-blue-900">
                      {selectedCurrency.symbol}{settings.booking_price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Stripe Fee (2.9% + $0.30):</span>
                    <span className="text-blue-900">
                      {selectedCurrency.symbol}{(settings.booking_price * 0.029 + 0.30).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span className="font-bold text-blue-900">You Receive:</span>
                    <span className="font-bold text-green-700">
                      {selectedCurrency.symbol}{(settings.booking_price - (settings.booking_price * 0.029 + 0.30)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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
        </div>
      </div>
    </div>
  );
}