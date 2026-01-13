import { useState, useEffect } from 'react';
import { useUpgrade } from '../context/UpgradeContext';
import {
  Sparkles,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Zap,
  Route,
  Clock,
  Calendar,
  Star,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Crown,
} from 'lucide-react';
import api from '../utils/api';

const RULE_TYPE_INFO = {
  routing: { icon: Route, label: 'Routing', color: 'blue', description: 'Route bookings to specific team members' },
  buffer: { icon: Clock, label: 'Buffer', color: 'green', description: 'Add time gaps between meetings' },
  availability: { icon: Calendar, label: 'Availability', color: 'purple', description: 'Block or allow specific times' },
  priority: { icon: Star, label: 'Priority', color: 'yellow', description: 'Mark certain bookings as important' },
  auto_response: { icon: MessageSquare, label: 'Auto Response', color: 'pink', description: 'Automatically handle bookings' },
  custom: { icon: Zap, label: 'Custom', color: 'gray', description: 'Custom rule' },
};

const EXAMPLE_RULES = [
  "Route demo requests to Sarah and Mike",
  "Add 15 minute buffer after every meeting",
  "No meetings on Fridays after 3pm",
  "VIP priority for emails from @acme.com",
  "Automatically confirm bookings under 30 minutes",
];

export default function SchedulingRules() {
  const { hasProFeature, showUpgradeModal, currentTier } = useUpgrade();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    if (hasProFeature()) {
      fetchRules();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchRules = async () => {
    try {
      const response = await api.get('/scheduling-rules');
      setRules(response.data.rules || []);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRule = async () => {
    if (!newRuleText.trim()) return;

    setCreating(true);
    try {
      const response = await api.post('/scheduling-rules', { rule_text: newRuleText });
      setRules([response.data.rule, ...rules]);
      setNewRuleText('');
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert(error.response?.data?.error || 'Failed to create rule');
    } finally {
      setCreating(false);
    }
  };

  const deleteRule = async (id) => {
    if (!confirm('Delete this rule?')) return;

    try {
      await api.delete(`/scheduling-rules/${id}`);
      setRules(rules.filter(r => r.id !== id));
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const toggleRule = async (id) => {
    try {
      const response = await api.patch(`/scheduling-rules/${id}/toggle`);
      setRules(rules.map(r => r.id === id ? response.data.rule : r));
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  // Pro gate
  if (!hasProFeature()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border-2 border-purple-200">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="h-10 w-10 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Smart Rules
            </h1>

            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              Create scheduling rules in plain English. No complex setup required.
            </p>

            <div className="bg-purple-50 rounded-2xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-purple-900 mb-4">Example rules you can create:</h3>
              <ul className="space-y-2">
                {EXAMPLE_RULES.map((example, i) => (
                  <li key={i} className="flex items-start gap-2 text-purple-800">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span>"{example}"</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => showUpgradeModal('rules')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg flex items-center gap-2 mx-auto"
            >
              <Crown className="h-5 w-5" />
              Upgrade to Pro - $12/month
            </button>

            <p className="text-sm text-gray-500 mt-4">
              Currently on: <span className="font-medium capitalize">{currentTier}</span> plan
            </p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Zap className="h-8 w-8 text-purple-600" />
            Smart Rules
          </h1>
          <p className="text-gray-600 mt-1">
            Create scheduling rules in plain English
          </p>
        </div>

        {/* Create Rule */}
        <div className="bg-white rounded-2xl border-2 border-purple-200 p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Create a new rule</h2>
              <p className="text-sm text-gray-500 mb-4">
                Describe what you want in plain English
              </p>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createRule()}
                  placeholder='e.g., "Add 15 min buffer after meetings"'
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                />
                <button
                  onClick={createRule}
                  disabled={creating || !newRuleText.trim()}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                  Add Rule
                </button>
              </div>

              {/* Examples Toggle */}
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                {showExamples ? 'Hide examples' : 'Show examples'}
              </button>

              {showExamples && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXAMPLE_RULES.map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setNewRuleText(example)}
                      className="text-left text-sm p-3 bg-gray-50 hover:bg-purple-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No rules yet</p>
            <p className="text-sm text-gray-400">Create your first rule above</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Your Rules ({rules.length})
            </h3>

            {rules.map((rule) => {
              const typeInfo = RULE_TYPE_INFO[rule.rule_type] || RULE_TYPE_INFO.custom;
              const Icon = typeInfo.icon;

              return (
                <div
                  key={rule.id}
                  className={`bg-white rounded-xl border-2 p-4 transition-all ${
                    rule.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      typeInfo.color === 'blue' ? 'bg-blue-100' :
                      typeInfo.color === 'green' ? 'bg-green-100' :
                      typeInfo.color === 'purple' ? 'bg-purple-100' :
                      typeInfo.color === 'yellow' ? 'bg-yellow-100' :
                      typeInfo.color === 'pink' ? 'bg-pink-100' :
                      'bg-gray-100'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        typeInfo.color === 'blue' ? 'text-blue-600' :
                        typeInfo.color === 'green' ? 'text-green-600' :
                        typeInfo.color === 'purple' ? 'text-purple-600' :
                        typeInfo.color === 'yellow' ? 'text-yellow-600' :
                        typeInfo.color === 'pink' ? 'text-pink-600' :
                        'text-gray-600'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        "{rule.rule_text}"
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          typeInfo.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          typeInfo.color === 'green' ? 'bg-green-100 text-green-700' :
                          typeInfo.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                          typeInfo.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          typeInfo.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {typeInfo.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          rule.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        title={rule.is_active ? 'Disable rule' : 'Enable rule'}
                      >
                        {rule.is_active ? (
                          <ToggleRight className="h-6 w-6" />
                        ) : (
                          <ToggleLeft className="h-6 w-6" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">How rules work</p>
              <ul className="space-y-1 text-blue-700">
                <li>* Rules are applied automatically when someone books with you</li>
                <li>* Higher priority rules are checked first</li>
                <li>* Toggle rules off temporarily without deleting them</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
