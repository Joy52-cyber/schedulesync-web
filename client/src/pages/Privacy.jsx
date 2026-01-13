import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
            <p className="text-gray-600 mb-4">
              When you use ScheduleSync, we collect information you provide directly to us, such as:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Account information (name, email address)</li>
              <li>Calendar data (availability, scheduled events)</li>
              <li>Booking information (meeting times, attendee details)</li>
              <li>Payment information (processed securely via Stripe)</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-600 mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process bookings and send confirmations</li>
              <li>Send you reminders and notifications</li>
              <li>Respond to your comments and questions</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Calendar Access</h2>
            <p className="text-gray-600 mb-6">
              ScheduleSync requests access to your calendar to check your availability and create booking events. 
              We only read the minimum information needed (busy/free times) and do not store the content of your events. 
              You can revoke calendar access at any time through your Google or Microsoft account settings.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Data Sharing</h2>
            <p className="text-gray-600 mb-6">
              We do not sell your personal information. We may share information with:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Service providers who assist in our operations (hosting, email delivery)</li>
              <li>Meeting attendees (limited to booking-related information)</li>
              <li>Legal authorities when required by law</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Data Security</h2>
            <p className="text-gray-600 mb-6">
              We implement appropriate security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>SSL/TLS encryption for data in transit</li>
              <li>Encrypted storage for sensitive data</li>
              <li>Regular security audits</li>
              <li>OAuth 2.0 for calendar authentication (we never see your calendar password)</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. Your Rights</h2>
            <p className="text-gray-600 mb-6">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and data</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">7. Contact Us</h2>
            <p className="text-gray-600 mb-6">
              If you have questions about this Privacy Policy, please contact us at:{' '}
              <a href="mailto:support@trucal.xyz" className="text-purple-600 hover:underline">
                support@trucal.xyz
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}