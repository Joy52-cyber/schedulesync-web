import { useState, useEffect } from 'react';
import { X, Save, User, Shield, TrendingUp, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function TeamMemberEditModal({ isOpen, onClose, member, teamId, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    role: 'member',
    priority: 1,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.user_name || member.name || '',
        role: member.role || 'member',
        priority: member.priority || 1,
        is_active: member.is_active !== false,
      });
    }
  }, [member]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!member) return;

    setSaving(true);
    try {
      const response = await api.patch(`/teams/${teamId}/members/${member.id}`, {
        name: formData.name || null,
        role: formData.role,
        priority: parseInt(formData.priority, 10),
        is_active: formData.is_active,
      });

      if (onSave) {
        onSave(response.data.member);
      }

      alert('Member updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error updating member:', error);
      alert(error.response?.data?.error || 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Member Settings</h2>
                <p className="text-blue-100 text-sm">
                  {member.user_name || member.name || member.email}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Member Info Display */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {member.user_name?.charAt(0) || member.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {member.user_name || member.name || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600 truncate">
                  {member.user_email || member.email}
                </p>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Display Name (Optional)
              </span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Leave empty to use account name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">
              Override the name from their account for this team
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role
              </span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Admins can manage team settings and members
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Priority
              </span>
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher priority members get bookings first in round-robin mode
            </p>
          </div>

          {/* Active Status */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <p className="font-semibold text-gray-900">Active Member</p>
                <p className="text-xs text-gray-600">
                  Inactive members won't receive bookings
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}