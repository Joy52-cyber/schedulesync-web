// Generate ICS (iCalendar) files for email attachments

const generateICS = (booking) => {
  const startDate = new Date(booking.start_time);
  const endDate = new Date(booking.end_time);

  // Format dates to iCal format (YYYYMMDDTHHMMSSZ)
  const formatICalDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScheduleSync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:booking-${booking.id}@schedulesync.com`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `DTSTART:${formatICalDate(startDate)}`,
    `DTEND:${formatICalDate(endDate)}`,
    `SUMMARY:Meeting with ${booking.attendee_name}`,
    `DESCRIPTION:${booking.notes || 'Scheduled via ScheduleSync'}`,
    `ORGANIZER;CN=${booking.organizer_name || booking.team_name}:mailto:${booking.organizer_email || 'noreply@schedulesync.com'}`,
    `ATTENDEE;CN=${booking.attendee_name};RSVP=TRUE:mailto:${booking.attendee_email}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Meeting in 24 hours',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return icsContent;
};

module.exports = { generateICS };