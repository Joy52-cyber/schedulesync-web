import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Sparkles,
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

  const { alerts, recommendations } = intelligence;

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
      {/* Proactive Alerts - Most Important */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            Insights & Alerts
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Actionable Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-600" />
            Recommendations
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
