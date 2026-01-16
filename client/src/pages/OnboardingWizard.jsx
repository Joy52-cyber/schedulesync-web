import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock,
  Globe,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Loader2,
  Mail,
  Zap,
  Calendar,
  Bot,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import api from '../utils/api';

// Generate time options in 30-minute intervals
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const time24 = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const timeLabel = `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`;
      options.push({ value: time24, label: timeLabel });
    }
  }
  return options;
};

const timeOptions = generateTimeOptions();

// Debounce helper
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { updateUser, user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  // Username validation state
  const [usernameCheck, setUsernameCheck] = useState({
    checking: false,
    available: null,
    message: '',
    suggestions: []
  });

  // Form State
  const [formData, setFormData] = useState({
    username: user?.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    availableFrom: '09:00',
    availableTo: '17:00',
    workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  });

  const daysOption = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totalSteps = 4;

  // Step labels for progress indicator
  const stepLabels = ['Profile', 'Schedule', 'Features', 'Done'];

  // LocalStorage key per user so onboarding only shows once
  const onboardingKey =
    user ? `onboardingCompleted:${user.id || user.email}` : null;

  // Check if onboarding already completed
  useEffect(() => {
    if (!user) return;

    const completedFromStorage =
      onboardingKey && localStorage.getItem(onboardingKey) === 'true';

    const alreadyCompleted =
      completedFromStorage || user.hasCompletedOnboarding;

    if (alreadyCompleted) {
      navigate('/dashboard', { replace: true });
    } else {
      setReady(true);
    }
  }, [user, onboardingKey, navigate]);

  // Username availability check
  const checkUsernameAvailability = useCallback(
    debounce(async (username) => {
      if (username.length < 3) {
        setUsernameCheck({
          checking: false,
          available: false,
          message: 'Username must be at least 3 characters',
          suggestions: []
        });
        return;
      }

      setUsernameCheck(prev => ({ ...prev, checking: true, message: 'Checking...' }));

      try {
        const response = await api.get(`/auth/check-username/${username}`);
        setUsernameCheck({
          checking: false,
          available: response.data.available,
          message: response.data.message,
          suggestions: response.data.suggestions || []
        });
      } catch (error) {
        console.error('Username check error:', error);
        setUsernameCheck({
          checking: false,
          available: null,
          message: 'Could not verify username',
          suggestions: []
        });
      }
    }, 500),
    []
  );

  // Check username when it changes
  useEffect(() => {
    if (formData.username && formData.username.length >= 1) {
      checkUsernameAvailability(formData.username);
    }
  }, [formData.username, checkUsernameAvailability]);

  const handleNext = () => {
    if (step < totalSteps) setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => prev - 1);
  };

  // Skip onboarding
  const handleSkip = async () => {
    setLoading(true);
    try {
      await api.put('/user/profile', {
        has_completed_onboarding: true
      });

      updateUser({ ...user, hasCompletedOnboarding: true });

      if (onboardingKey) {
        localStorage.setItem(onboardingKey, 'true');
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Skip failed:', err);
      setError('Failed to skip. Please try again.');
    } finally {
      setLoading(false);
    }
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
      // 1. Send data to backend
      await api.put('/user/profile', {
        username: formData.username,
        timezone: formData.timezone,
        availability: {
          start: formData.availableFrom,
          end: formData.availableTo,
          days: formData.workDays,
        },
        has_completed_onboarding: true,
      });

      // 2. Update auth context
      updateUser({
        ...user,
        username: formData.username,
        hasCompletedOnboarding: true,
      });

      // 3. Persist in localStorage
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

  // Can proceed to next step?
  const canProceed = () => {
    if (step === 1) {
      return formData.username.length >= 3 && usernameCheck.available === true;
    }
    return true;
  };

  // While we're checking if onboarding should show, show nothing or a loader
  if (!user || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur-xl border border-purple-100 shadow-2xl rounded-3xl overflow-hidden transition-all duration-500">
        {/* Progress Bar */}
        <div className="bg-gray-100 h-1.5 w-full">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between px-8 py-4 border-b border-gray-100">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum < step;
            const isCurrent = stepNum === step;
            return (
              <div
                key={label}
                className={`flex flex-col items-center gap-1.5 ${
                  stepNum <= step ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-purple-600 text-white ring-4 ring-purple-200'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? <Check size={16} /> : stepNum}
                </div>
                <span className="text-xs font-medium text-gray-600">{label}</span>
              </div>
            );
          })}
        </div>

        <div className="p-8 sm:p-10">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200 text-center flex items-center justify-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* STEP 1: Profile */}
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
                  Let&apos;s claim your unique booking link.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                  Create your URL
                </label>
                <div className={`flex rounded-xl shadow-sm ring-1 transition-all overflow-hidden ${
                  usernameCheck.available === true
                    ? 'ring-green-500 focus-within:ring-2 focus-within:ring-green-500'
                    : usernameCheck.available === false
                    ? 'ring-red-300 focus-within:ring-2 focus-within:ring-red-500'
                    : 'ring-gray-200 focus-within:ring-2 focus-within:ring-purple-500'
                }`}>
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
                          .replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                    className="flex-1 min-w-0 block w-full px-4 py-3 bg-white border-0 focus:ring-0 sm:text-sm text-gray-900 placeholder-gray-400"
                    placeholder="john-doe"
                  />
                  <div className="flex items-center px-3">
                    {usernameCheck.checking ? (
                      <Loader2 size={18} className="animate-spin text-gray-400" />
                    ) : usernameCheck.available === true ? (
                      <Check size={18} className="text-green-500" />
                    ) : usernameCheck.available === false ? (
                      <X size={18} className="text-red-500" />
                    ) : null}
                  </div>
                </div>

                {/* Username feedback */}
                <div className="mt-2 ml-1">
                  {usernameCheck.message && (
                    <p className={`text-xs flex items-center gap-1 ${
                      usernameCheck.available === true
                        ? 'text-green-600'
                        : usernameCheck.available === false
                        ? 'text-red-500'
                        : 'text-gray-400'
                    }`}>
                      {usernameCheck.available === true && <Check size={12} />}
                      {usernameCheck.available === false && <X size={12} />}
                      {usernameCheck.message}
                    </p>
                  )}

                  {/* Suggestions if username is taken */}
                  {usernameCheck.suggestions?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Try these:</p>
                      <div className="flex flex-wrap gap-2">
                        {usernameCheck.suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setFormData({ ...formData, username: suggestion })}
                            className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                    We&apos;ve set your timezone to{' '}
                    <strong>{formData.timezone}</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="w-full py-4 px-6 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 shadow-lg"
                >
                  Next Step <ChevronRight size={20} />
                </button>
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                >
                  Skip for now, I&apos;ll set this up later
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Schedule */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Clock size={28} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  Set availability
                </h2>
                <p className="text-gray-500">
                  Define your standard working hours.
                </p>
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
                        setFormData({
                          ...formData,
                          availableFrom: e.target.value,
                        })
                      }
                      className="block w-full pl-4 pr-10 py-3 text-base border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent sm:text-sm rounded-xl bg-gray-50"
                    >
                      {timeOptions
                        .filter((t) => t.value < formData.availableTo)
                        .map((time) => (
                          <option key={time.value} value={time.value}>
                            {time.label}
                          </option>
                        ))}
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
                        setFormData({
                          ...formData,
                          availableTo: e.target.value,
                        })
                      }
                      className="block w-full pl-4 pr-10 py-3 text-base border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent sm:text-sm rounded-xl bg-gray-50"
                    >
                      {timeOptions
                        .filter((t) => t.value > formData.availableFrom)
                        .map((time) => (
                          <option key={time.value} value={time.value}>
                            {time.label}
                          </option>
                        ))}
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

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200 transition-all flex items-center gap-2"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-4 px-6 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg"
                >
                  Next Step <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Feature Showcase */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Sparkles size={28} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  Power up with AI
                </h2>
                <p className="text-gray-500">
                  Enable smart features to save hours every week.
                </p>
              </div>

              {/* Info Banner */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Pro tip:</strong> You can always enable or disable features
                  later from the Settings page.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200 transition-all flex items-center gap-2"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-4 px-6 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg"
                >
                  Continue <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Completion */}
          {step === 4 && (
            <div className="text-center space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-25" />
                <div className="relative w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={48} strokeWidth={2.5} />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  You&apos;re all set!
                </h2>
                <p className="text-gray-500 max-w-xs mx-auto">
                  We&apos;ve created your booking page and a default 30-min
                  event type.
                </p>
              </div>

              {/* Summary Card */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-2xl border border-gray-200">
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <User size={16} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                        Your Link
                      </p>
                      <p className="text-sm font-bold text-purple-600">
                        schedulesync.com/{formData.username}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Clock size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                        Availability
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {timeOptions.find(t => t.value === formData.availableFrom)?.label} -{' '}
                        {timeOptions.find(t => t.value === formData.availableTo)?.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Calendar size={16} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                        Working Days
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {formData.workDays.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200 transition-all flex items-center gap-2"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> Setting up
                      dashboard...
                    </>
                  ) : (
                    <>
                      Go to Dashboard <ChevronRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
