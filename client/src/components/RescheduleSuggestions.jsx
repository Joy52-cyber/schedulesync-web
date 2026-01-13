import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  Calendar,
  Check,
  X,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../utils/api';

export default function RescheduleSuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await api.get('/reschedule-suggestions');
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConflicts = async () => {
    setChecking(true);
    try {
      const response = await api.post('/check-conflicts');
      if (response.data.conflicts_found > 0) {
        fetchSuggestions();
      } else {
        alert('No conflicts found! Your calendar is clear.');
      }
    } catch (error) {
      console.error('Failed to check conflicts:', error);
    } finally {
      setChecking(false);
    }
  };

  const acceptSuggestion = async (id, selectedTime) => {
    setAccepting(id);
    try {
      await api.post(`/reschedule-suggestions/${id}/accept`, { selected_time: selectedTime });
      setSuggestions(suggestions.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      alert('Failed to reschedule. Please try again.');
    } finally {
      setAccepting(null);
    }
  };

  const declineSuggestion = async (id) => {
    try {
      await api.post(`/reschedule-suggestions/${id}/decline`);
      setSuggestions(suggestions.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to decline suggestion:', error);
    }
  };

  const formatDateTime = (iso) => {
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (iso) => {
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Smart Rescheduling</h3>
            <p className="text-xs text-gray-500">AI-powered conflict resolution</p>
          </div>
        </div>
        <button
          onClick={checkConflicts}
          disabled={checking}
          className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 flex items-center gap-1.5 disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Check Conflicts
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-6 bg-green-50 rounded-xl">
          <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-green-800 font-medium">No conflicts detected</p>
          <p className="text-sm text-green-600">Your calendar is optimized</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => {
            const suggestedTimes = JSON.parse(suggestion.suggested_times || '[]');
            const isExpanded = expanded === suggestion.id;

            return (
              <div
                key={suggestion.id}
                className="border-2 border-orange-200 bg-orange-50 rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{suggestion.title}</p>
                      <p className="text-sm text-gray-600">with {suggestion.attendee_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full">
                          {suggestion.reason === 'conflict' ? 'Conflict' : 'Optimization'}
                        </span>
                        <span className="text-xs text-gray-500">
                          Currently: {formatDateTime(suggestion.original_time)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => declineSuggestion(suggestion.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Dismiss"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Toggle alternatives */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : suggestion.id)}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-sm text-orange-700 hover:text-orange-800 font-medium"
                >
                  <Sparkles className="h-4 w-4" />
                  {isExpanded ? 'Hide' : 'Show'} {suggestedTimes.length} suggested times
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {/* Alternatives */}
                {isExpanded && (
                  <div className="mt-3 grid gap-2">
                    {suggestedTimes.map((slot, i) => (
                      <button
                        key={i}
                        onClick={() => acceptSuggestion(suggestion.id, slot.start)}
                        disabled={accepting === suggestion.id}
                        className="flex items-center justify-between p-3 bg-white border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 rounded-lg transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {formatDateTime(slot.start)}
                          </span>
                        </div>
                        {accepting === suggestion.id ? (
                          <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                        ) : (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="h-5 w-5" />
                            <span className="text-sm font-medium">Select</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
