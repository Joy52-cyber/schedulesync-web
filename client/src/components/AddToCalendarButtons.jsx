import { Calendar, Download } from 'lucide-react';

export default function AddToCalendarButtons({ booking }) {
  const {
    title = 'Meeting',
    start_time,
    end_time,
    location = '',
    description = '',
    meet_link = '',
    attendee_name = ''
  } = booking || {};

  if (!start_time || !end_time) {
    return null;
  }

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);

  // Build description with meet link
  const fullDescription = meet_link
    ? `${description}\n\nJoin meeting: ${meet_link}`
    : description;

  // Format for Google Calendar
  const formatGoogleDate = (date) => {
    return date.toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(fullDescription)}&location=${encodeURIComponent(meet_link || location)}`;

  // Format for Outlook
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${encodeURIComponent(fullDescription)}&location=${encodeURIComponent(meet_link || location)}`;

  // Format for Yahoo
  const formatYahooDate = (date) => {
    return date.toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, -1);
  };

  const durationMinutes = Math.round((endDate - startDate) / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const yahooDuration = `${hours.toString().padStart(2, '0')}${mins.toString().padStart(2, '0')}`;

  const yahooUrl = `https://calendar.yahoo.com/?v=60&title=${encodeURIComponent(title)}&st=${formatYahooDate(startDate)}&dur=${yahooDuration}&desc=${encodeURIComponent(fullDescription)}&in_loc=${encodeURIComponent(meet_link || location)}`;

  // Generate .ics file
  const generateICS = () => {
    const formatICSDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, -1) + 'Z';
    };

    // Escape special characters for ICS format
    const escapeICS = (text) => {
      return (text || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ScheduleSync//NONSGML v1.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${booking.id || Date.now()}@schedulesync.app`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${escapeICS(title)}`,
      `DESCRIPTION:${escapeICS(fullDescription)}`,
      meet_link ? `LOCATION:${escapeICS(meet_link)}` : '',
      meet_link ? `URL:${meet_link}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Add to Calendar</p>
      <div className="flex flex-wrap gap-2">
        {/* Google Calendar */}
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google
        </a>

        {/* Outlook */}
        <a
          href={outlookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.576-.16.154-.354.23-.583.23h-8.547v-6.959l1.6 1.229c.104.08.216.119.337.119.12 0 .233-.04.337-.119l.119-.1 6.737-5.173c.045.08.082.17.11.27.029.1.043.202.043.308l.085 1.14z"/>
            <path fill="#0078D4" d="M15.072 8.393l-6.11 4.693c-.178.134-.356.2-.532.2-.178 0-.356-.066-.533-.2l-6.11-4.693C.593 7.49 0 6.357 0 5.129V4.49c0-.596.194-1.09.58-1.478.387-.388.882-.582 1.478-.582h12.956c.596 0 1.09.194 1.478.582.387.387.58.882.58 1.478v.639c0 1.228-.594 2.361-1.78 3.264z"/>
            <path fill="#28A8EA" d="M14.632 11.712v6.959H.58c-.228 0-.422-.077-.58-.23-.16-.153-.238-.347-.238-.576V7.387c0-.107.015-.21.043-.308.028-.1.065-.19.11-.27l6.737 5.173.119.1c.104.079.217.119.337.119.12 0 .233-.04.337-.119l6.11-4.693c.08.1.15.213.209.337.059.124.089.254.089.389v3.597z"/>
          </svg>
          Outlook
        </a>

        {/* Yahoo */}
        <a
          href={yahooUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#6001D2" d="M12.813 12L24 0h-5.077L12 6.923 5.077 0H0l11.187 12L5.077 24h5.077L12 17.077 17.923 24H24l-11.187-12z"/>
          </svg>
          Yahoo
        </a>

        {/* Download .ics */}
        <button
          onClick={generateICS}
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
        >
          <Download className="w-4 h-4" />
          .ics File
        </button>
      </div>
    </div>
  );
}
