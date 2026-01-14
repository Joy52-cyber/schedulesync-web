import { useState, useEffect } from 'react';
import { useUpgrade } from '../context/UpgradeContext';
import {
  Bot,
  Loader2,
  Check,
  AlertTriangle,
  Crown,
  Zap,
  Clock,
  Calendar,
  Mail,
  Shield,
  ToggleLeft,
  ToggleRight,
  Plus,
  X,
  Info
} from 'lucide-react';
import api from '../utils/api';

const MODES = [
  {
    id: 'manual',
    name: 'Manual',
    description: 'You review and confirm every booking',
    icon: Shield,
    color: 'gray'
  },
  {
    id: 'suggest',
    name: 'AI Suggests',
    description: 'AI suggests actions, you approve',
    icon: Zap,
    color: 'blue'
  },
  {
    id: 'auto',
    name: 'Fully Autonomous',
    description: 'AI automatically handles bookings based on your rules',
    icon: Bot,
    color: 'purple'
  }
];

export default function AutonomousSettings() {
  const { hasTeamFeature, showUpgradeModal, currentTier } = useUpgrade();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('manual');
  const [rules, setRules] = useState({
    max_duration: 60,
    allowed_hours_start: 9,
    allowed_hours_end: 17,
    blocked_days: [],
    max_daily_bookings: 8,
    vip_domains: [],
    blocked_domains: []
  });
  const [newVipDomain, setNewVipDomain] = useState('');
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/autonomous-settings');
      setMode(response.data.mode || 'manual');
      setRules({ ...rules, ...response.data.rules });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/autonomous-settings', { mode, rules });
      alert('Settings saved!');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testAutoConfirm = async () => {
    try {
      const testTime = new Date();
      testTime.setHours(14, 0, 0, 0);
      testTime.setDate(testTime.getDate() + 1);

      const response = await api.post('/test-auto-confirm', {
        start_time: testTime.toISOString(),
        duration: 30,
        attendee_email: 'test@example.com'
      });
      setTestResult(response.data);
    } catch (error) {
      console.error('Test failed:', error);
    }
  };

  const toggleDay = (day) => {
    if (rules.blocked_days.includes(day)) {
      setRules({ ...rules, blocked_days: rules.blocked_days.filter(d => d !== day) });
    } else {
      setRules({ ...rules, blocked_days: [...rules.blocked_days, day] });
    }
  };

  const addVipDomain = () => {
    if (newVipDomain && !rules.vip_domains.includes(newVipDomain)) {
      setRules({ ...rules, vip_domains: [...rules.vip_domains, newVipDomain] });
      setNewVipDomain('');
    }
  };

  const addBlockedDomain = () => {
    if (newBlockedDomain && !rules.blocked_domains.includes(newBlockedDomain)) {
      setRules({ ...rules, blocked_domains: [...rules.blocked_domains, newBlockedDomain] });
      setNewBlockedDomain('');
    }
  };

  // Team gate
  if (!hasTeamFeature()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border-2 border-purple-200">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bot className="h-10 w-10 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Autonomous Mode
            </h1>

            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              Let AI handle your scheduling automatically based on your rules.
            </p>

            <div className="bg-purple-50 rounded-2xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-purple-900 mb-4">What it can do:</h3>
              <ul className="space-y-2 text-purple-800">
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Auto-confirm bookings that match your criteria
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Block unwanted time slots automatically
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  VIP treatment for important contacts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-purple-600" />
                  Set daily booking limits
                </li>
              </ul>
            </div>

            <button
              onClick={() => showUpgradeModal('autonomous')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg flex items-center gap-2 mx-auto"
            >
              <Crown className="h-5 w-5" />
              Upgrade to Team - $25/month
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            Autonomous Mode
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Let AI handle your scheduling based on your rules
          </p>
        </div>

        {/* Mode Selector */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4 text-sm sm:text-base">Scheduling Mode</h2>
          <div className="grid gap-2 sm:gap-3">
            {MODES.map((m) => {
              const Icon = m.icon;
              const isSelected = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? `border-${m.color}-500 bg-${m.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSelected ? `bg-${m.color}-500` : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm sm:text-base ${isSelected ? `text-${m.color}-900` : 'text-gray-900'}`}>
                      {m.name}
                    </p>
                    <p className={`text-xs sm:text-sm ${isSelected ? `text-${m.color}-700` : 'text-gray-500'}`}>
                      {m.description}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className={`h-5 w-5 sm:h-6 sm:w-6 text-${m.color}-600 flex-shrink-0`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rules - Only show for suggest/auto modes */}
        {mode !== 'manual' && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 p-4 sm:p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 text-sm sm:text-base">
              <Zap className="h-5 w-5 text-purple-600" />
              Auto-Confirm Rules
            </h2>

            <div className="space-y-6">
              {/* Max Duration */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Maximum Meeting Duration
                </label>
                <select
                  value={rules.max_duration}
                  onChange={(e) => setRules({ ...rules, max_duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>2 hours</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Meetings longer than this will require approval
                </p>
              </div>

              {/* Allowed Hours */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Allowed Hours
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <select
                    value={rules.allowed_hours_start}
                    onChange={(e) => setRules({ ...rules, allowed_hours_start: parseInt(e.target.value) })}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm"
                  >
                    {[...Array(24)].map((_, i) => (
                      <option key={i} value={i}>{i}:00</option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-center">to</span>
                  <select
                    value={rules.allowed_hours_end}
                    onChange={(e) => setRules({ ...rules, allowed_hours_end: parseInt(e.target.value) })}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm"
                  >
                    {[...Array(24)].map((_, i) => (
                      <option key={i} value={i}>{i}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Blocked Days */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Block Days (require approval)
                </label>
                <div className="flex flex-wrap gap-2">
                  {days.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                        rules.blocked_days.includes(day)
                          ? 'bg-red-100 text-red-700 border-2 border-red-300'
                          : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Daily Bookings */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Maximum Daily Bookings
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={rules.max_daily_bookings}
                  onChange={(e) => setRules({ ...rules, max_daily_bookings: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl"
                />
              </div>

              {/* VIP Domains */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Mail className="h-4 w-4 inline mr-1" />
                  VIP Domains (always auto-confirm)
                </label>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="text"
                    value={newVipDomain}
                    onChange={(e) => setNewVipDomain(e.target.value)}
                    placeholder="e.g., google.com"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl text-sm"
                  />
                  <button
                    onClick={addVipDomain}
                    className="w-full sm:w-auto px-4 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 flex items-center justify-center"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="sm:hidden ml-2">Add Domain</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rules.vip_domains.map((domain) => (
                    <span key={domain} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      {domain}
                      <button onClick={() => setRules({ ...rules, vip_domains: rules.vip_domains.filter(d => d !== domain) })}>
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Blocked Domains */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Blocked Domains (always require approval)
                </label>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="text"
                    value={newBlockedDomain}
                    onChange={(e) => setNewBlockedDomain(e.target.value)}
                    placeholder="e.g., spam.com"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl text-sm"
                  />
                  <button
                    onClick={addBlockedDomain}
                    className="w-full sm:w-auto px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 flex items-center justify-center"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="sm:hidden ml-2">Add Domain</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rules.blocked_domains.map((domain) => (
                    <span key={domain} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                      {domain}
                      <button onClick={() => setRules({ ...rules, blocked_domains: rules.blocked_domains.filter(d => d !== domain) })}>
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Section */}
        {mode !== 'manual' && (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 sm:p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-4 text-sm sm:text-base">Test Your Rules</h2>
            <button
              onClick={testAutoConfirm}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 font-medium"
            >
              Test with sample booking
            </button>

            {testResult && (
              <div className={`mt-4 p-4 rounded-xl ${testResult.autoConfirm ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'}`}>
                <p className={`font-semibold ${testResult.autoConfirm ? 'text-green-800' : 'text-yellow-800'}`}>
                  {testResult.autoConfirm ? '✅ Would be auto-confirmed' : '⏳ Would require approval'}
                </p>
                <p className={`text-sm mt-1 ${testResult.autoConfirm ? 'text-green-700' : 'text-yellow-700'}`}>
                  {testResult.reason}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 sm:p-4 mb-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-blue-800">
              <p className="font-semibold mb-1">How it works</p>
              <ul className="space-y-1 text-blue-700">
                <li>• <strong>Manual:</strong> All bookings require your confirmation</li>
                <li>• <strong>AI Suggests:</strong> Bookings go to pending, AI suggests action</li>
                <li>• <strong>Fully Autonomous:</strong> AI auto-confirms if rules pass, else pending</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
