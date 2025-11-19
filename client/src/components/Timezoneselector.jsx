import { useState, useEffect } from 'react';
import { Globe, Check, MapPin } from 'lucide-react';
import { TIMEZONES, getBrowserTimezone, getTimezoneAbbr } from '../utils/timezone';

export default function TimezoneSelector({ value, onChange, showLabel = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [detectedTimezone, setDetectedTimezone] = useState(null);

  useEffect(() => {
    // Detect browser timezone on mount
    const detected = getBrowserTimezone();
    setDetectedTimezone(detected);
    
    // If no value set, use detected
    if (!value && onChange) {
      onChange(detected);
    }
  }, []);

  const filteredTimezones = TIMEZONES.filter(tz =>
    tz.label.toLowerCase().includes(search.toLowerCase()) ||
    tz.value.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTimezone = TIMEZONES.find(tz => tz.value === value);

  return (
    <div className="relative">
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Globe className="inline h-4 w-4 mr-1" />
          Timezone
        </label>
      )}

      {/* Selected Timezone Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left bg-white border-2 border-gray-300 rounded-xl hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500" />
            <div>
              <p className="font-medium text-gray-900">
                {selectedTimezone?.label || 'Select timezone'}
              </p>
              <p className="text-xs text-gray-500">
                {selectedTimezone?.offset || 'Choose your timezone'}
              </p>
            </div>
          </div>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-96 overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search timezones..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Detected Timezone (if different from selected) */}
            {detectedTimezone && detectedTimezone !== value && (
              <div className="p-2 bg-blue-50 border-b border-blue-100">
                <button
                  type="button"
                  onClick={() => {
                    onChange(detectedTimezone);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        Use detected timezone
                      </p>
                      <p className="text-xs text-blue-700">
                        {TIMEZONES.find(tz => tz.value === detectedTimezone)?.label}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Timezone List */}
            <div className="overflow-y-auto max-h-80">
              {filteredTimezones.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No timezones found
                </div>
              ) : (
                filteredTimezones.map((tz) => (
                  <button
                    key={tz.value}
                    type="button"
                    onClick={() => {
                      onChange(tz.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                      value === tz.value ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={`font-medium ${
                          value === tz.value ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {tz.label}
                        </p>
                        <p className="text-xs text-gray-500">{tz.offset}</p>
                      </div>
                      {value === tz.value && (
                        <Check className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}