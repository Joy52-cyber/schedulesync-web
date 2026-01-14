import { useState } from 'react';
import { Plus, X, Users } from 'lucide-react';

export default function AdditionalGuestsInput({ guests = [], onChange, max = 5 }) {
  const [showInput, setShowInput] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', email: '' });

  const addGuest = () => {
    if (newGuest.email && newGuest.name) {
      onChange([...guests, { ...newGuest, id: Date.now() }]);
      setNewGuest({ name: '', email: '' });
      setShowInput(false);
    }
  };

  const removeGuest = (id) => {
    onChange(guests.filter(g => g.id !== id));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && newGuest.name && newGuest.email) {
      e.preventDefault();
      addGuest();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Users className="w-4 h-4" />
          Additional Guests
          <span className="text-gray-400 font-normal">({guests.length}/{max})</span>
        </label>
        {guests.length < max && !showInput && (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Guest
          </button>
        )}
      </div>

      {/* Existing guests */}
      {guests.map(guest => (
        <div key={guest.id} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-purple-600 dark:text-purple-400 text-sm font-medium">
              {guest.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{guest.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{guest.email}</p>
          </div>
          <button
            type="button"
            onClick={() => removeGuest(guest.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Add guest form */}
      {showInput && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
          <input
            type="text"
            value={newGuest.name}
            onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
            onKeyPress={handleKeyPress}
            placeholder="Guest name"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            autoFocus
          />
          <input
            type="email"
            value={newGuest.email}
            onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
            onKeyPress={handleKeyPress}
            placeholder="Guest email"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addGuest}
              disabled={!newGuest.name || !newGuest.email}
              className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setNewGuest({ name: '', email: '' });
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {guests.length >= max && (
        <p className="text-xs text-gray-500 dark:text-gray-400">Maximum {max} additional guests allowed</p>
      )}
    </div>
  );
}
