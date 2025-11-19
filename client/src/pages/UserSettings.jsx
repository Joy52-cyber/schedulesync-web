import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, Globe, User, Bell } from 'lucide-react';
import api from '../utils/api';
import TimezoneSelector from '../components/TimezoneSelector';
import { getBrowserTimezone, formatInTimezone } from '../utils/timezone';

export default function UserSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    timezone: 'America/New_York',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/user/timezone');
      setSettings({
        timezone: response.data.timezone || getBrowserTimezone(),
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use browser timezone as fallback
      setSettings({
        timezone: getBrowserTimezone(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/user/timezone', { timezone: settings.timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      
      // Save to localStorage for immediate use
      localStorage.setItem('userTimezone', settings.timezone);
    } catch (error) {
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account preferences</p>
      </div>

      {/* Timezone Settings */}
      <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Timezone Preferences</h2>
            <p className="text-sm text-gray-600">Set your default timezone for bookings</p>
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="mb-6">
          <TimezoneSelector
            value={settings.timezone}
            onChange={(timezone) => setSettings({ ...settings, timezone })}
          />
        </div>

        {/* Preview */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-2">
            <Globe className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-2">Preview</p>
              <p className="text-sm text-blue-800">
                Current time in your timezone:
              </p>
              <p className="text-lg font-bold text-blue-900 mt-1">
                {formatInTimezone(now, settings.timezone, 'long')}
              </p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">How timezone settings work:</p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>• All meeting times are displayed in your selected timezone</li>
                <li>• Booking pages automatically show times in guest's timezone</li>
                <li>• Email reminders include times in both timezones</li>
                <li>• Database stores all times in UTC for accuracy</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="h-5 w-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Additional Settings Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 opacity-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Bell className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
            <p className="text-sm text-gray-600">Coming soon...</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 opacity-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Profile Settings</h2>
            <p className="text-sm text-gray-600">Coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}