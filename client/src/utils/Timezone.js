// ============ TIMEZONE UTILITIES ============
// Place this in: client/src/utils/timezone.js

// List of common timezones
export const TIMEZONES = [
  // North America
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },
  
  // Europe
  { value: 'Europe/London', label: 'London (GMT)', offset: 'UTC+0' },
  { value: 'Europe/Paris', label: 'Paris (CET)', offset: 'UTC+1' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', offset: 'UTC+1' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)', offset: 'UTC+1' },
  { value: 'Europe/Rome', label: 'Rome (CET)', offset: 'UTC+1' },
  { value: 'Europe/Athens', label: 'Athens (EET)', offset: 'UTC+2' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)', offset: 'UTC+3' },
  
  // Asia
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 'UTC+4' },
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: 'UTC+5:30' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', offset: 'UTC+7' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 'UTC+8' },
  { value: 'Asia/Manila', label: 'Manila (PHT)', offset: 'UTC+8' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: 'UTC+8' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: 'UTC+8' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)', offset: 'UTC+9' },
  
  // Australia
  { value: 'Australia/Perth', label: 'Perth (AWST)', offset: 'UTC+8' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST)', offset: 'UTC+9:30' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)', offset: 'UTC+10' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: 'UTC+11' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT)', offset: 'UTC+11' },
  
  // Pacific
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT)', offset: 'UTC+13' },
  { value: 'Pacific/Fiji', label: 'Fiji (FJT)', offset: 'UTC+12' },
];

/**
 * Get browser's detected timezone
 */
export const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Failed to detect timezone:', error);
    return 'America/New_York'; // Default fallback
  }
};

/**
 * Format date in specific timezone
 */
export const formatInTimezone = (date, timezone, format = 'long') => {
  const d = new Date(date);
  
  if (format === 'long') {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(d);
  }
  
  if (format === 'short') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(d);
  }
  
  if (format === 'time') {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(d);
  }
  
  if (format === 'date') {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    }).format(d);
  }
  
  return d.toLocaleString('en-US', { timeZone: timezone });
};

/**
 * Get timezone abbreviation (EST, PST, etc)
 */
export const getTimezoneAbbr = (timezone) => {
  const tz = TIMEZONES.find(t => t.value === timezone);
  return tz ? tz.label.match(/\(([^)]+)\)/)?.[1] || tz.offset : timezone;
};

/**
 * Convert UTC time to local timezone
 */
export const utcToLocal = (utcDate, timezone) => {
  return new Date(utcDate).toLocaleString('en-US', { timeZone: timezone });
};

/**
 * Check if timezone is valid
 */
export const isValidTimezone = (timezone) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get user's saved timezone from localStorage or detect it
 */
export const getUserTimezone = () => {
  // First check localStorage
  const saved = localStorage.getItem('userTimezone');
  if (saved && isValidTimezone(saved)) {
    return saved;
  }
  
  // Otherwise detect from browser
  const detected = getBrowserTimezone();
  
  // Save for next time
  localStorage.setItem('userTimezone', detected);
  
  return detected;
};

/**
 * Save user's timezone preference
 */
export const saveUserTimezone = (timezone) => {
  if (isValidTimezone(timezone)) {
    localStorage.setItem('userTimezone', timezone);
    return true;
  }
  return false;
};

/**
 * Format date range with timezone
 */
export const formatDateRange = (startDate, endDate, timezone) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const date = formatInTimezone(start, timezone, 'date');
  const startTime = formatInTimezone(start, timezone, 'time');
  const endTime = formatInTimezone(end, timezone, 'time');
  
  return `${date}, ${startTime} - ${endTime}`;
};

/**
 * Get timezone offset string (e.g., "GMT-5")
 */
export const getTimezoneOffset = (timezone) => {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  });
  
  const match = formatted.match(/GMT([+-]\d+)/);
  return match ? match[1] : '';
};

/**
 * Compare two timezones
 */
export const compareTimezones = (tz1, tz2) => {
  const date = new Date();
  const time1 = new Date(date.toLocaleString('en-US', { timeZone: tz1 }));
  const time2 = new Date(date.toLocaleString('en-US', { timeZone: tz2 }));
  
  const diff = (time1 - time2) / (1000 * 60 * 60); // Difference in hours
  
  return {
    difference: Math.abs(diff),
    tz1Ahead: diff > 0,
    message: diff === 0 
      ? 'Same timezone' 
      : `${Math.abs(diff)} hours ${diff > 0 ? 'ahead' : 'behind'}`,
  };
};