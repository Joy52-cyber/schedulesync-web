import { useState, useEffect } from 'react';
import { Bell, Clock, Save, Loader2, CheckCircle } from 'lucide-react';
import api from '../utils/api';

export default function ReminderSettings() {
  const [settings, setSettings] = useState({
    reminder_enabled: true,
    reminder_hours_before: 24,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/user/reminder-settings');
      setSettings(data);
    } catch (error) {
      console.error('Failed to load reminder settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/user/reminder-settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert('Failed to save reminder settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // … keep the rest of your JSX exactly as you already wrote …
  // (no change needed to the UI itself)
};
