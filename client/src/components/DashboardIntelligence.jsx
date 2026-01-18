import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Sparkles,
  Calendar,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  FileText,
  Repeat,
  Share2,
  ArrowRight,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function DashboardIntelligence() {
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadIntelligence();
  }, []);

  const loadIntelligence = async () => {
    try {
      const response = await api.get('/dashboard/intelligence');
      setIntelligence(response.data);
    } catch (error) {
      console.error('Failed to load intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border-2 border-gray-200 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!intelligence) return null;

  const { alerts, relationships, patterns, recommendations, weekAnalysis } = intelligence;

  // Icon mapping
  const iconMap = {
    'alert-triangle': AlertTriangle,
    'sparkles': Sparkles,
    'calendar-off': Calendar,
    'alert-circle': AlertCircle,
    'file-text': FileText,
    'zap': Zap,
    'repeat': Repeat,
    'share-2': Share2,
    'users': Users,
    'clock': Clock,
  };

  // Color mapping
  const colorMap = {
    orange: { bg: 'from-orange-500 to-red-500', border: 'border-orange-300', text: 'text-orange-800', lightBg: 'bg-orange-50' },
    blue: { bg: 'from-blue-500 to-cyan-500', border: 'border-blue-300', text: 'text-blue-800', lightBg: 'bg-blue-50' },
    green: { bg: 'from-green-500 to-emerald-500', border: 'border-green-300', text: 'text-green-800', lightBg: 'bg-green-50' },
    purple: { bg: 'from-purple-500 to-pink-500', border: 'border-purple-300', text: 'text-purple-800', lightBg: 'bg-purple-50' },
    red: { bg: 'from-red-500 to-rose-500', border: 'border-red-300', text: 'text-red-800', lightBg: 'bg-red-50' },
    pink: { bg: 'from-pink-500 to-rose-500', border: 'border-pink-300', text: 'text-pink-800', lightBg: 'bg-pink-50' },
  };

  return (
    <div className="space-y-6">
      {/* Proactive Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Proactive Insights
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {alerts.map((alert, idx) => {
              const Icon = iconMap[alert.icon] || AlertCircle;
              const colors = colorMap[alert.color] || colorMap.blue;

              return (
                <div
                  key={idx}
                  className={`bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 ${colors.border} shadow-lg hover:shadow-xl transition-shadow`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{alert.title}</h3>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                    </div>
                  </div>
                  {alert.action && (
                    <button
                      onClick={() => navigate(alert.action.link)}
                      className={`w-full mt-3 px-4 py-2 bg-gradient-to-r ${colors.bg} text-white rounded-lg font-semibold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-2`}
                    >
                      {alert.action.text}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week Analysis */}
      {weekAnalysis && weekAnalysis.thisWeek !== undefined && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-200 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              This Week's Activity
            </h3>
            {weekAnalysis.trend === 'up' && <TrendingUp className="h-5 w-5 text-green-600" />}
            {weekAnalysis.trend === 'down' && <TrendingDown className="h-5 w-5 text-red-600" />}
            {weekAnalysis.trend === 'stable' && <Minus className="h-5 w-5 text-gray-600" />}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{weekAnalysis.thisWeek}</div>
              <div className="text-sm text-gray-600">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">{weekAnalysis.avgWeekly}</div>
              <div className="text-sm text-gray-600">Avg Weekly</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${weekAnalysis.percentChange > 0 ? 'text-green-600' : weekAnalysis.percentChange < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {weekAnalysis.percentChange > 0 ? '+' : ''}{weekAnalysis.percentChange}%
              </div>
              <div className="text-sm text-gray-600">vs Average</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Collaborators */}
      {relationships && relationships.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-200 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            Your Top Collaborators
          </h3>
          <div className="space-y-3">
            {relationships.map((person, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{person.name}</div>
                    <div className="text-xs text-gray-600">{person.email}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-700">{person.meetingCount} meetings</div>
                  <div className="text-xs text-gray-600">
                    {person.daysSinceLastMeeting === 0 ? 'Today' : `${person.daysSinceLastMeeting}d ago`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Behavioral Patterns */}
      {patterns && (patterns.busiestDay || patterns.preferredHour) && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600" />
            Your Meeting Patterns
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {patterns.busiestDay && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-sm text-gray-600 mb-1">Busiest Day</div>
                <div className="text-2xl font-bold text-purple-700">{patterns.busiestDay}</div>
                <div className="text-xs text-gray-600 mt-1">{patterns.busiestDayCount} meetings</div>
              </div>
            )}
            {patterns.preferredHour !== null && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-sm text-gray-600 mb-1">Preferred Time</div>
                <div className="text-2xl font-bold text-purple-700">{patterns.preferredHourDisplay}</div>
                <div className="text-xs text-gray-600 mt-1">Most common</div>
              </div>
            )}
            {patterns.avgDuration && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-sm text-gray-600 mb-1">Avg Duration</div>
                <div className="text-2xl font-bold text-purple-700">{patterns.avgDuration} min</div>
                <div className="text-xs text-gray-600 mt-1">Per meeting</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actionable Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Recommendations
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {recommendations.map((rec, idx) => {
              const Icon = iconMap[rec.icon] || Info;
              const colors = colorMap[rec.color] || colorMap.blue;

              return (
                <div
                  key={idx}
                  className={`bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 ${colors.border} shadow-lg hover:shadow-xl transition-shadow`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{rec.title}</h3>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                    </div>
                  </div>
                  {rec.action && (
                    <button
                      onClick={() => navigate(rec.action.link)}
                      className={`w-full mt-3 px-4 py-2 ${colors.lightBg} ${colors.text} rounded-lg font-semibold text-sm hover:shadow-md transition-all flex items-center justify-center gap-2 border ${colors.border}`}
                    >
                      {rec.action.text}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
