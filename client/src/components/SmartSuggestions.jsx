import { useState, useEffect } from 'react';
import { Sparkles, Clock, Calendar, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import api from '../utils/api';

export default function SmartSuggestions({ duration, attendeeEmail, timezone, onSelectSlot }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.smart.getSuggestions({
        duration: duration || 30,
        attendeeEmail: attendeeEmail || null,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        maxSlots: 5
      });

      setSuggestions(response.data.suggestions || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Failed to load smart suggestions:', err);
      setError('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  const getScoreColor = (score) => {
    if (score >= 140) return 'from-green-500 to-emerald-600';
    if (score >= 120) return 'from-blue-500 to-indigo-600';
    if (score >= 100) return 'from-purple-500 to-pink-600';
    return 'from-gray-500 to-gray-600';
  };

  const getScoreBadge = (score) => {
    if (score >= 140) return { text: 'Highly Recommended', color: 'bg-green-100 text-green-800 border-green-200' };
    if (score >= 120) return { text: 'Recommended', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (score >= 100) return { text: 'Good Match', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    return { text: 'Available', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  if (!showSuggestions) {
    return (
      <button
        onClick={loadSuggestions}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Smart Suggestions...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Show Smart Suggestions
          </>
        )}
      </button>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
        <button
          onClick={() => {
            setShowSuggestions(false);
            setError(null);
          }}
          className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (suggestions.length === 0 && !loading) {
    return (
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center">
        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No available time slots found</p>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your availability settings</p>
        <button
          onClick={() => setShowSuggestions(false)}
          className="mt-4 text-sm text-purple-600 hover:text-purple-700 underline"
        >
          Hide suggestions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Smart Suggestions</h3>
            <p className="text-xs text-gray-600">AI-recommended times based on your patterns</p>
          </div>
        </div>
        <button
          onClick={() => setShowSuggestions(false)}
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Hide
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {suggestions.map((suggestion, index) => {
          const { date, time } = formatDateTime(suggestion.start);
          const badge = getScoreBadge(suggestion.score);

          return (
            <button
              key={index}
              onClick={() => onSelectSlot && onSelectSlot(suggestion)}
              className="relative bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-purple-400 hover:shadow-lg transition-all text-left group"
            >
              {/* Best Match Badge */}
              {index === 0 && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Best Match
                </div>
              )}

              {/* Score Badge */}
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border mb-3 ${badge.color}`}>
                <TrendingUp className="h-3 w-3" />
                {badge.text}
              </div>

              {/* Date & Time */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-gray-900">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span className="font-semibold">{date}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{time}</span>
                </div>
              </div>

              {/* Reasoning */}
              {suggestion.reasoning && (
                <div className="text-xs text-gray-600 border-t pt-2">
                  <p className="line-clamp-2">{suggestion.reasoning}</p>
                </div>
              )}

              {/* Hover Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none"></div>
            </button>
          );
        })}
      </div>

      {suggestions.length > 0 && (
        <div className="text-center pt-2">
          <p className="text-xs text-gray-500">
            💡 Times are ranked by your booking patterns, attendee preferences, and optimal scheduling
          </p>
        </div>
      )}
    </div>
  );
}
