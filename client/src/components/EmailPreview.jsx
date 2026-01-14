import { useState } from 'react';
import { X, Monitor, Smartphone, Send, Eye } from 'lucide-react';

const SAMPLE_DATA = {
  guestName: 'John Smith',
  hostName: 'Jane Doe',
  meetingTitle: '30-Minute Consultation',
  meetingDate: 'Monday, January 20, 2026',
  meetingTime: '2:00 PM',
  meetingDuration: '30 minutes',
  meetingLocation: 'Google Meet',
  timezone: 'America/New_York',
  manageLink: 'https://example.com/manage/abc123',
  bookingLink: 'https://example.com/book/xyz789'
};

export default function EmailPreview({
  template,
  type = 'confirmation',
  isOpen,
  onClose,
  onSendTest
}) {
  const [viewMode, setViewMode] = useState('desktop'); // desktop | mobile
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  // Replace template variables with sample data
  const replaceVariables = (text) => {
    if (!text) return '';
    let result = text;
    Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  const previewSubject = replaceVariables(template?.subject || getDefaultSubject(type));
  const previewBody = replaceVariables(template?.body || getDefaultBody(type));

  const handleSendTest = async () => {
    setIsSending(true);
    try {
      await onSendTest?.();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Email Preview</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {type.charAt(0).toUpperCase() + type.slice(1)} email
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('desktop')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'desktop'
                    ? 'bg-white dark:bg-gray-600 shadow text-purple-600 dark:text-purple-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
                title="Desktop view"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('mobile')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'mobile'
                    ? 'bg-white dark:bg-gray-600 shadow text-purple-600 dark:text-purple-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
                title="Mobile view"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-gray-900">
          <div
            className={`mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all ${
              viewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'
            }`}
          >
            {/* Email header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-16">From:</span>
                  <span className="text-gray-900 dark:text-white">noreply@trucal.xyz</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-16">To:</span>
                  <span className="text-gray-900 dark:text-white">john.smith@example.com</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-16">Subject:</span>
                  <span className="text-gray-900 dark:text-white font-medium">{previewSubject}</span>
                </div>
              </div>
            </div>

            {/* Email body */}
            <div
              className="p-6"
              dangerouslySetInnerHTML={{ __html: previewBody }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This is a preview with sample data
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
            {onSendTest && (
              <button
                onClick={handleSendTest}
                disabled={isSending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Sending...' : 'Send Test Email'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getDefaultSubject(type) {
  const subjects = {
    confirmation: 'Meeting Confirmed: {{meetingTitle}}',
    reminder: 'Reminder: {{meetingTitle}} - {{meetingDate}}',
    cancellation: 'Meeting Cancelled: {{meetingTitle}}',
    reschedule: 'Meeting Rescheduled: {{meetingTitle}}'
  };
  return subjects[type] || subjects.confirmation;
}

function getDefaultBody(type) {
  const bodies = {
    confirmation: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #ec4899); padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Confirmed!</h1>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p style="color: #374151; font-size: 16px;">Hi {{guestName}},</p>
          <p style="color: #374151; font-size: 16px;">Your meeting with <strong>{{hostName}}</strong> has been confirmed.</p>
          <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <table style="width: 100%;">
              <tr><td style="padding: 8px 0; color: #6b7280;">Date</td><td style="color: #111827; font-weight: 500;">{{meetingDate}}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Time</td><td style="color: #111827; font-weight: 500;">{{meetingTime}}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Duration</td><td style="color: #111827; font-weight: 500;">{{meetingDuration}}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Location</td><td style="color: #111827; font-weight: 500;">{{meetingLocation}}</td></tr>
            </table>
          </div>
          <div style="text-align: center;">
            <a href="{{manageLink}}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Manage Booking</a>
          </div>
        </div>
        <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
          Powered by ScheduleSync
        </div>
      </div>
    `,
    reminder: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Reminder</h1>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p style="color: #374151; font-size: 16px;">Hi {{guestName}},</p>
          <p style="color: #374151; font-size: 16px;">This is a reminder about your upcoming meeting with <strong>{{hostName}}</strong>.</p>
          <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <h2 style="color: #111827; margin: 0 0 16px 0;">{{meetingTitle}}</h2>
            <p style="color: #6b7280; margin: 4px 0;">{{meetingDate}} at {{meetingTime}}</p>
            <p style="color: #6b7280; margin: 4px 0;">{{meetingLocation}}</p>
          </div>
        </div>
      </div>
    `,
    cancellation: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444, #f97316); padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Cancelled</h1>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p style="color: #374151; font-size: 16px;">Hi {{guestName}},</p>
          <p style="color: #374151; font-size: 16px;">Your meeting with <strong>{{hostName}}</strong> has been cancelled.</p>
          <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <p style="color: #6b7280;">The following meeting is no longer scheduled:</p>
            <p style="color: #111827; font-weight: 500;">{{meetingTitle}}</p>
            <p style="color: #6b7280;">{{meetingDate}} at {{meetingTime}}</p>
          </div>
          <div style="text-align: center;">
            <a href="{{bookingLink}}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Book Again</a>
          </div>
        </div>
      </div>
    `,
    reschedule: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #eab308); padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Rescheduled</h1>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p style="color: #374151; font-size: 16px;">Hi {{guestName}},</p>
          <p style="color: #374151; font-size: 16px;">Your meeting with <strong>{{hostName}}</strong> has been rescheduled.</p>
          <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <h3 style="color: #111827; margin: 0 0 16px 0;">New Time:</h3>
            <p style="color: #111827; font-weight: 500; font-size: 18px;">{{meetingDate}}</p>
            <p style="color: #111827; font-weight: 500; font-size: 18px;">{{meetingTime}}</p>
          </div>
          <div style="text-align: center;">
            <a href="{{manageLink}}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Manage Booking</a>
          </div>
        </div>
      </div>
    `
  };
  return bodies[type] || bodies.confirmation;
}
