import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock,
  Globe,
  User,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import api from '../utils/api';

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { updateUser, user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    username: user?.email?.split('@')[0] || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    availableFrom: '09:00',
    availableTo: '17:00',
    workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  });

  const daysOption = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // 🔐 LocalStorage key per user so onboarding only shows once
  const onboardingKey =
    user ? `onboardingCompleted:${user.id || user.email}` : null;

  // If user already completed onboarding (flag or context), skip wizard
  useEffect(() => {
    if (!user) return;

    const alreadyCompleted =
      (onboardingKey && localStorage.getItem(onboardingKey) === 'true') ||
      user.hasCompletedOnboarding;

    if (alreadyCompleted) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, onboardingKey, navigate]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleDayToggle = (day) => {
    setFormData((prev) => {
      const newDays = prev.workDays.includes(day)
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day];
      return { ...prev, workDays: newDays };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Send data to backend (adjust endpoint as needed)
      await api.put('/users/profile', {
        username: formData.username,
        timezone: formData.timezone,
        availability: {
          start: formData.availableFrom,
          end: formData.availableTo,
          days: formData.workDays,
        },
        has_completed_onboarding: true, // optional if backend supports it
      });

      // 2. Update auth context so the rest of the app knows onboarding is done
      updateUser({
        ...user,
        username: formData.username,
        hasCompletedOnboarding: true,
      });

      // 3. Persist in localStorage so we never show onboarding again for this user
      if (onboardingKey) {
        localStorage.setItem(onboardingKey, 'true');
      }

      // 4. Redirect to dashboard
      navigate('/dashboard', { replace: true });

    } catch (err) {
      console.error('Onboarding failed:', err);
      setError(
        err?.response?.data?.error ||
          'Failed to save profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur-xl border border-purple-100 shadow-2xl rounded-3xl overflow-hidden transition-all duration-500">
        
        {/* Progress Bar */}
        <div className="bg-gray-100 h-1.5 w-full">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-8 sm:p-10">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200 text-center">
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <User size={28} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  Welcome to ScheduleSync!
                </h2>
                <p className="text-gray-500">
                  Let's claim your unique booking link.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                  Create your URL
                </label>
                <div className="flex rounded-xl shadow-sm ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-purple-500 transition-all overflow-hidden">
                  <span className="inline-flex items-center px-4 bg-gray-50 text-gray-500 sm:text-sm font-medium border-r border-gray-200">
                    schedulesync.com/
                  </span>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '-'),
                      })
                    }
                    className="flex-1 min-w-0 block w-full px-4 py-3 bg-white border-0 focus:ring-0 sm:text-sm text-gray-900 placeholder-gray-400"
                    placeholder="john-doe"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400 ml-1">
                  This will be your public profile link.
                </p>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-xl flex items-start gap-3 border border-blue-100">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">
                    Timezone Detected
                  </p>
                  <p className="text-sm text-blue-700 mt-0.5">
                    We've set your timezone to <strong>{formData.timezone}</strong>.
                  </p>
                </div>
              </div>

              <button
                onClick={handleNext}
                disabled={!formData.username}
                className="w-full py-4 px-6 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 shadow-lg"
              >
                Next Step <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Clock size={28} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  Set availability
                </h2>
                <p className="text-gray-500">Define your standard working hours.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Start Time
                  </label>
                  <div className="relative">
                    <select
                      value={formData.availableFrom}
                      onChange={(e) =>
                        setFormData({ ...formData, availableFrom: e.target.value })
                      }
                      className="block w-full pl-4 pr-10 py-3 text-base border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent sm:text-sm rounded-xl bg-gray-50"
                    >
                      <option value="08:00">08:00 AM</option>
                      <option value="09:00">09:00 AM</option>
                      <option value="10:00">10:00 AM</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                    End Time
                  </label>
                  <div className="relative">
                    <select
                      value={formData.availableTo}
                      onChange={(e) =>
                        setFormData({ ...formData, availableTo: e.target.value })
                      }
                      className="block w-full pl-4 pr-10 py-3 text-base border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent sm:text-sm rounded-xl bg-gray-50"
                    >
                      <option value="16:00">04:00 PM</option>
                      <option value="17:00">05:00 PM</option>
                      <option value="18:00">06:00 PM</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Available Days
                </label>
                <div className="flex justify-between gap-2">
                  {daysOption.map((day) => {
                    const isSelected = formData.workDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayToggle(day)}
                        className={`w-10 h-10 rounded-full text-xs font-bold transition-all duration-200 ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-md transform scale-110'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {day.charAt(0)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full py-4 px-6 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg"
              >
                Next Step <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="text-center space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-25"></div>
                <div className="relative w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={48} strokeWidth={2.5} />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  You're all set!
                </h2>
                <p className="text-gray-500 max-w-xs mx-auto">
                  We've created your booking page and a default 30-min meeting type.
                </p>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-2xl border border-gray-200 transform transition-transform hover:scale-[1.02] cursor-default">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2 flex items-center justify-center gap-2">
                  <Sparkles size={12} className="text-purple-500" /> Your Personal Link
                </p>
                <p className="text-lg font-bold text-purple-600 break-all">
                  schedulesync.com/{formData.username}
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Setting up dashboard...
                  </>
                ) : (
                  <>
                    Go to Dashboard <ChevronR
