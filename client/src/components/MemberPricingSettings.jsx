import { useState, useMemo } from 'react';
import { X, DollarSign, ShieldCheck } from 'lucide-react';
import api from '../utils/api'; // adjust if your api import is different

export default function MemberPricingSettings({ member, teamId, onClose, onSaved }) {
  const [requirePayment, setRequirePayment] = useState(
    !!member.payment_required
  );
  const [currency, setCurrency] = useState(member.currency || 'USD');
  const [sessionPrice, setSessionPrice] = useState(
    member.booking_price ? String(member.booking_price) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Parse numeric price safely
  const numericPrice = useMemo(() => {
    const n = parseFloat(sessionPrice || '0');
    return Number.isNaN(n) ? 0 : n;
  }, [sessionPrice]);

  const stripeFee = useMemo(() => {
    // 2.9% + 0.30 (approx)
    return numericPrice > 0 ? numericPrice * 0.029 + 0.3 : 0;
  }, [numericPrice]);

  const netAmount = useMemo(() => {
    return Math.max(numericPrice - stripeFee, 0);
  }, [numericPrice, stripeFee]);

  const handleSessionPriceChange = (e) => {
    let val = e.target.value;

    // allow empty
    if (val === '') {
      setSessionPrice('');
      return;
    }

    // prevent multiple dots
    if ((val.match(/\./g) || []).length > 1) {
      return;
    }

    // remove leading zeros before digits (keep "0.xxx")
    val = val.replace(/^0+(?=\d)/, '');

    setSessionPrice(val);
  };

  const formatMoney = (value) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (requirePayment && !sessionPrice) {
      setError('Please enter a session price.');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        // 🔴 match backend expectation:
        booking_price: numericPrice,           // goes to booking_price
        currency,                              // goes to currency
        payment_required: requirePayment,      // goes to payment_required
      };

      // ✅ match your backend route: /api/teams/:teamId/members/:memberId/pricing
      await api.post(
        `/teams/${teamId}/members/${member.id}/pricing`,
        payload
      );

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          'Something went wrong while saving pricing settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol =
    currency === 'USD'
      ? '$'
      : currency === 'EUR'
      ? '€'
      : currency === 'GBP'
      ? '£'
      : currency === 'PHP'
      ? '₱'
      : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Pricing Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <p className="text-sm text-gray-600">
            {member.user_name || member.name || 'Member'}
          </p>

          {/* Require payment toggle card */}
          <div className="rounded-2xl border border-green-200 bg-green-50/60 p-4 flex items-start gap-3">
            <div className="mt-1">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-gray-900">
                  Require Payment for Bookings
                </p>
                <button
                  type="button"
                  onClick={() => setRequirePayment((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    requirePayment ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      requirePayment ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-600">
                When enabled, guests must complete payment before confirming
                their booking.
              </p>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none text-sm"
              disabled={!requirePayment}
            >
              <option value="USD">$ USD - US Dollar</option>
              <option value="EUR">€ EUR - Euro</option>
              <option value="GBP">£ GBP - British Pound</option>
              <option value="PHP">₱ PHP - Philippine Peso</option>
            </select>
          </div>

          {/* Session Price */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Session Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                {currencySymbol}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={sessionPrice}
                onChange={handleSessionPriceChange}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none text-lg font-semibold"
                disabled={!requirePayment}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Amount charged per booking session.
            </p>
          </div>

          {/* Revenue breakdown */}
          <div className="mt-2 rounded-2xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-2 text-sm font-semibold">
              Revenue Breakdown
            </div>
            <div className="bg-white px-4 py-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Guest Payment</span>
                <span className="font-semibold">
                  {currencySymbol}
                  {formatMoney(numericPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">
                  Stripe Fee
                  <span className="block text-xs text-gray-500">
                    2.9% + 0.30 (approx)
                  </span>
                </span>
                <span className="font-semibold text-red-600">
                  -{currencySymbol}
                  {formatMoney(stripeFee)}
                </span>
              </div>
              <div className="mt-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 text-white flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-semibold text-sm">You Receive</div>
                  <div>Per booking</div>
                </div>
                <div className="text-lg font-bold">
                  {currencySymbol}
                  {formatMoney(netAmount)}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
