import { Crown, ArrowRight, Sparkles, Zap, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Premium Upgrade Card - Reusable component for Pro plan promotion
export default function UpgradeCard({
  variant = 'default',
  compact = false,
  className = ''
}) {
  const navigate = useNavigate();

  const variants = {
    default: {
      title: 'Upgrade to Pro',
      description: 'Unlimited bookings, AI features, and priority support.',
      icon: Crown,
      gradient: 'from-purple-600 to-pink-600',
      bgGradient: 'from-purple-50 to-pink-50',
      borderColor: 'border-purple-300'
    },
    ai: {
      title: 'Unlock Unlimited AI',
      description: 'Unlimited ChatGPT queries and advanced AI features.',
      icon: Sparkles,
      gradient: 'from-blue-600 to-cyan-600',
      bgGradient: 'from-blue-50 to-cyan-50',
      borderColor: 'border-blue-300'
    },
    team: {
      title: 'Upgrade to Team',
      description: 'Team scheduling, admin controls, and collaboration.',
      icon: Users,
      gradient: 'from-green-600 to-emerald-600',
      bgGradient: 'from-green-50 to-emerald-50',
      borderColor: 'border-green-300'
    },
    power: {
      title: 'Go Pro',
      description: 'Unlimited everything. No limits, no compromises.',
      icon: Zap,
      gradient: 'from-orange-600 to-red-600',
      bgGradient: 'from-orange-50 to-red-50',
      borderColor: 'border-orange-300'
    }
  };

  const config = variants[variant] || variants.default;
  const IconComponent = config.icon;

  if (compact) {
    return (
      <div className={`bg-gradient-to-br ${config.bgGradient} border-2 ${config.borderColor} rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${config.gradient} rounded-lg flex items-center justify-center shadow-lg flex-shrink-0`}>
              <IconComponent className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{config.title}</h3>
              <p className="text-xs text-gray-600">{config.description}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/billing')}
            className={`group px-4 py-2 bg-gradient-to-r ${config.gradient} text-white rounded-lg hover:shadow-lg transition-all font-semibold text-sm whitespace-nowrap flex items-center gap-2`}
          >
            Upgrade
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br ${config.bgGradient} border-2 ${config.borderColor} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all ${className}`}>
      {/* Icon */}
      <div className={`w-14 h-14 bg-gradient-to-br ${config.gradient} rounded-xl flex items-center justify-center shadow-lg mb-4`}>
        <IconComponent className="w-7 h-7 text-white" />
      </div>

      {/* Content */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          {config.title}
          <Crown className="w-5 h-5 text-amber-500" />
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">
          {config.description}
        </p>

        {/* Price */}
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-4xl font-bold text-gray-900">$15</span>
          <span className="text-gray-600">/month</span>
        </div>
        <p className="text-xs text-gray-500">or $144/year (save 20%)</p>
      </div>

      {/* CTA Button */}
      <button
        onClick={() => navigate('/billing')}
        className={`group w-full bg-gradient-to-r ${config.gradient} text-white px-6 py-3 rounded-xl font-bold hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2`}
      >
        Upgrade Now
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Features List */}
      <div className="mt-4 pt-4 border-t-2 border-white/50">
        <ul className="space-y-2 text-xs text-gray-700">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full"></div>
            <span>Unlimited bookings</span>
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full"></div>
            <span>Unlimited AI queries</span>
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full"></div>
            <span>Priority support</span>
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full"></div>
            <span>Advanced analytics</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
