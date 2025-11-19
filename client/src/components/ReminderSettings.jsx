import { useState, useEffect } from 'react';
import { Bell, Clock, Save, Loader2, CheckCircle } from 'lucide-react';
import api from '../utils/api';

export default function ReminderSettings({ teamId }) {
  const [settings, setSettings] = useState({
    reminder_enabled: true,
    reminder_hours_before: 24,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [teamId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/teams/${teamId}/reminder-settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load reminder settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/teams/${teamId}/reminder-settings`, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert('Failed to save reminder settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Bell className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Reminder Settings</h3>
          <p className="text-sm text-gray-600">Configure automatic meeting reminders</p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-gray-600 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Enable Automatic Reminders</p>
              <p className="text-sm text-gray-600 mt-1">
                Send reminder emails before scheduled meetings
              </p>
            </div>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={settings.reminder_enabled}
              onChange={(e) =>
                setSettings({ ...settings, reminder_enabled: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
          </div>
        </label>
      </div>

      {/* Timing Settings */}
      {settings.reminder_enabled && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Send reminders
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { value: 1, label: '1 hour before' },
                { value: 2, label: '2 hours before' },
                { value: 24, label: '24 hours before' },
                { value: 48, label: '48 hours before' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setSettings({ ...settings, reminder_hours_before: option.value })
                  }
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    settings.reminder_hours_before === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                  }`}
                >
                  <Clock className="h-4 w-4 mx-auto mb-1" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">Preview</p>
                <p className="text-sm text-blue-800">
                  Reminders will be sent <span className="font-semibold">{settings.reminder_hours_before} hours before</span> each meeting to both the organizer and attendee.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* What's Included */}
      <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl">
        <p className="text-sm font-semibold text-purple-900 mb-3">
          📬 What's included in reminders:
        </p>
        <ul className="space-y-2 text-sm text-purple-800">
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <span>Meeting date, time, and duration</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <span>Participant information</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <span>Meeting notes (if provided)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <span>Calendar attachment (.ics file)</span>
          </li>
        </ul>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
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
  );
}