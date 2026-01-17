/**
 * Recurrence Service
 * Handles recurring meeting logic, RRULE parsing/generation, and instance creation
 */

const { DateTime } = require('luxon');

/**
 * Parse natural language into recurrence pattern
 * Examples:
 * - "every Monday" → { frequency: 'WEEKLY', daysOfWeek: ['monday'], interval: 1 }
 * - "bi-weekly on Tuesdays" → { frequency: 'WEEKLY', daysOfWeek: ['tuesday'], interval: 2 }
 * - "every weekday" → { frequency: 'WEEKLY', daysOfWeek: ['monday','tuesday','wednesday','thursday','friday'], interval: 1 }
 * - "monthly on the 15th" → { frequency: 'MONTHLY', interval: 1, dayOfMonth: 15 }
 */
function parseRecurrenceFromNaturalLanguage(text) {
  const normalizedText = text.toLowerCase();

  // Check if this is a recurring pattern
  const isRecurring = /\b(every|weekly|daily|monthly|bi-weekly|recurring|repeat)\b/.test(normalizedText);

  if (!isRecurring) {
    return null;
  }

  const recurrence = {
    frequency: null,
    interval: 1,
    daysOfWeek: [],
    dayOfMonth: null,
    endDate: null
  };

  // Detect frequency
  if (/\b(every day|daily)\b/.test(normalizedText)) {
    recurrence.frequency = 'DAILY';
  } else if (/\b(every week|weekly)\b/.test(normalizedText)) {
    recurrence.frequency = 'WEEKLY';
  } else if (/\b(bi-weekly|biweekly|every (two|2) weeks)\b/.test(normalizedText)) {
    recurrence.frequency = 'WEEKLY';
    recurrence.interval = 2;
  } else if (/\b(monthly|every month)\b/.test(normalizedText)) {
    recurrence.frequency = 'MONTHLY';
  } else if (/\b(yearly|annually|every year)\b/.test(normalizedText)) {
    recurrence.frequency = 'YEARLY';
  }

  // Detect days of week for WEEKLY recurrence
  const dayPattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend)\b/g;
  const dayMatches = normalizedText.match(dayPattern);

  if (dayMatches) {
    const days = new Set();
    dayMatches.forEach(day => {
      if (day === 'weekday') {
        days.add('monday');
        days.add('tuesday');
        days.add('wednesday');
        days.add('thursday');
        days.add('friday');
      } else if (day === 'weekend') {
        days.add('saturday');
        days.add('sunday');
      } else {
        days.add(day);
      }
    });
    recurrence.daysOfWeek = Array.from(days);

    // If days are specified but no frequency, assume WEEKLY
    if (!recurrence.frequency) {
      recurrence.frequency = 'WEEKLY';
    }
  }

  // Detect day of month for MONTHLY
  const dayOfMonthMatch = normalizedText.match(/\b(\d{1,2})(st|nd|rd|th)\b/);
  if (dayOfMonthMatch && recurrence.frequency === 'MONTHLY') {
    recurrence.dayOfMonth = parseInt(dayOfMonthMatch[1]);
  }

  // Detect end date
  const endDateMatch = normalizedText.match(/until\s+([a-z]+\s+\d{1,2}|\d{1,2}\/\d{1,2}\/?\d{0,4})/i);
  if (endDateMatch) {
    try {
      const endDate = DateTime.fromFormat(endDateMatch[1], 'MMMM d').toJSDate();
      if (endDate) {
        recurrence.endDate = endDate;
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }

  // Detect count (number of occurrences)
  const countMatch = normalizedText.match(/\b(\d+)\s+(times|occurrences)\b/);
  if (countMatch) {
    recurrence.count = parseInt(countMatch[1]);
  }

  return recurrence.frequency ? recurrence : null;
}

/**
 * Convert recurrence pattern to RRULE string (iCalendar format)
 * Example: { frequency: 'WEEKLY', daysOfWeek: ['monday', 'wednesday'], interval: 1 }
 * → "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE"
 */
function generateRRule(recurrence) {
  if (!recurrence || !recurrence.frequency) {
    return null;
  }

  const parts = [`FREQ=${recurrence.frequency}`];

  if (recurrence.interval && recurrence.interval > 1) {
    parts.push(`INTERVAL=${recurrence.interval}`);
  }

  if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
    const dayAbbrevs = recurrence.daysOfWeek.map(day => dayToRRuleAbbrev(day));
    parts.push(`BYDAY=${dayAbbrevs.join(',')}`);
  }

  if (recurrence.dayOfMonth) {
    parts.push(`BYMONTHDAY=${recurrence.dayOfMonth}`);
  }

  if (recurrence.endDate) {
    const dtend = DateTime.fromJSDate(recurrence.endDate).toFormat('yyyyMMdd');
    parts.push(`UNTIL=${dtend}`);
  }

  if (recurrence.count) {
    parts.push(`COUNT=${recurrence.count}`);
  }

  return parts.join(';');
}

/**
 * Convert day name to RRULE abbreviation
 */
function dayToRRuleAbbrev(day) {
  const map = {
    'monday': 'MO',
    'tuesday': 'TU',
    'wednesday': 'WE',
    'thursday': 'TH',
    'friday': 'FR',
    'saturday': 'SA',
    'sunday': 'SU'
  };
  return map[day.toLowerCase()] || day.substring(0, 2).toUpperCase();
}

/**
 * Parse RRULE string back to recurrence object
 */
function parseRRule(rrule) {
  if (!rrule) return null;

  const recurrence = {
    frequency: null,
    interval: 1,
    daysOfWeek: [],
    dayOfMonth: null,
    endDate: null,
    count: null
  };

  const parts = rrule.split(';');
  parts.forEach(part => {
    const [key, value] = part.split('=');

    switch (key) {
      case 'FREQ':
        recurrence.frequency = value;
        break;
      case 'INTERVAL':
        recurrence.interval = parseInt(value);
        break;
      case 'BYDAY':
        recurrence.daysOfWeek = value.split(',').map(abbrev => rruleAbbrevToDay(abbrev));
        break;
      case 'BYMONTHDAY':
        recurrence.dayOfMonth = parseInt(value);
        break;
      case 'UNTIL':
        try {
          recurrence.endDate = DateTime.fromFormat(value, 'yyyyMMdd').toJSDate();
        } catch (error) {
          // Ignore
        }
        break;
      case 'COUNT':
        recurrence.count = parseInt(value);
        break;
    }
  });

  return recurrence;
}

/**
 * Convert RRULE abbreviation to day name
 */
function rruleAbbrevToDay(abbrev) {
  const map = {
    'MO': 'monday',
    'TU': 'tuesday',
    'WE': 'wednesday',
    'TH': 'thursday',
    'FR': 'friday',
    'SA': 'saturday',
    'SU': 'sunday'
  };
  return map[abbrev.toUpperCase()] || abbrev.toLowerCase();
}

/**
 * Generate recurring instances for a given date range
 * Returns array of { start_time, end_time } objects
 */
function generateRecurringInstances(startTime, endTime, recurrence, maxInstances = 52) {
  if (!recurrence || !recurrence.frequency) {
    return [{ start_time: startTime, end_time: endTime }];
  }

  const instances = [];
  const start = DateTime.fromJSDate(new Date(startTime));
  const duration = DateTime.fromJSDate(new Date(endTime)).diff(start);

  let current = start;
  let count = 0;
  const maxDate = recurrence.endDate ? DateTime.fromJSDate(recurrence.endDate) : start.plus({ years: 1 });

  while (count < maxInstances && current <= maxDate) {
    // Check if this instance should be included based on recurrence rules
    let includeInstance = false;

    switch (recurrence.frequency) {
      case 'DAILY':
        includeInstance = true;
        break;

      case 'WEEKLY':
        if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          const dayName = current.toFormat('EEEE').toLowerCase();
          includeInstance = recurrence.daysOfWeek.includes(dayName);
        } else {
          includeInstance = true;
        }
        break;

      case 'MONTHLY':
        if (recurrence.dayOfMonth) {
          includeInstance = current.day === recurrence.dayOfMonth;
        } else {
          includeInstance = current.day === start.day;
        }
        break;

      case 'YEARLY':
        includeInstance = current.month === start.month && current.day === start.day;
        break;
    }

    if (includeInstance) {
      instances.push({
        start_time: current.toJSDate(),
        end_time: current.plus(duration).toJSDate()
      });
      count++;
    }

    // Advance to next potential instance
    switch (recurrence.frequency) {
      case 'DAILY':
        current = current.plus({ days: recurrence.interval || 1 });
        break;
      case 'WEEKLY':
        if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          // Move to next day in the week
          current = current.plus({ days: 1 });
          // If we've checked all days this week, skip to next interval
          if (current.weekday === 1) { // Monday
            current = current.plus({ weeks: (recurrence.interval || 1) - 1 });
          }
        } else {
          current = current.plus({ weeks: recurrence.interval || 1 });
        }
        break;
      case 'MONTHLY':
        current = current.plus({ months: recurrence.interval || 1 });
        break;
      case 'YEARLY':
        current = current.plus({ years: recurrence.interval || 1 });
        break;
    }

    // Safety check to prevent infinite loops
    if (count >= maxInstances) {
      console.warn(`⚠️ Reached max instances (${maxInstances}) for recurring meeting`);
      break;
    }
  }

  return instances;
}

/**
 * Format recurrence as human-readable text
 */
function formatRecurrenceText(recurrence) {
  if (!recurrence || !recurrence.frequency) {
    return 'One-time meeting';
  }

  const parts = [];

  // Frequency
  if (recurrence.interval === 1) {
    parts.push(recurrence.frequency.toLowerCase());
  } else if (recurrence.interval === 2 && recurrence.frequency === 'WEEKLY') {
    parts.push('bi-weekly');
  } else {
    parts.push(`every ${recurrence.interval} ${recurrence.frequency.toLowerCase()}`);
  }

  // Days of week
  if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
    const days = recurrence.daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
    parts.push(`on ${days}`);
  }

  // Day of month
  if (recurrence.dayOfMonth) {
    const suffix = getOrdinalSuffix(recurrence.dayOfMonth);
    parts.push(`on the ${recurrence.dayOfMonth}${suffix}`);
  }

  // End date or count
  if (recurrence.endDate) {
    const endDateStr = DateTime.fromJSDate(recurrence.endDate).toFormat('MMM d, yyyy');
    parts.push(`until ${endDateStr}`);
  } else if (recurrence.count) {
    parts.push(`for ${recurrence.count} occurrences`);
  }

  return parts.join(' ');
}

/**
 * Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

module.exports = {
  parseRecurrenceFromNaturalLanguage,
  generateRRule,
  parseRRule,
  generateRecurringInstances,
  formatRecurrenceText,
  dayToRRuleAbbrev,
  rruleAbbrevToDay
};
