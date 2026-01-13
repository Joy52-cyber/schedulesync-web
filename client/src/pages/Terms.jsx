import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';

export default function Terms() {
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
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-600 mb-6">
              By accessing or using ScheduleSync ("Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use the Service.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
            <p className="text-gray-600 mb-6">
              ScheduleSync is an AI-powered scheduling platform that allows users to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Create and manage booking pages</li>
              <li>Schedule meetings with AI assistance</li>
              <li>Sync with Google and Microsoft calendars</li>
              <li>Send automated booking confirmations and reminders</li>
              <li>Manage team scheduling</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Account Registration</h2>
            <p className="text-gray-600 mb-6">
              To use certain features, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Subscription Plans</h2>
            <p className="text-gray-600 mb-4">
              ScheduleSync offers the following plans:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li><strong>Free:</strong> 50 bookings/month, 10 AI queries/month, 3 magic links/month</li>
              <li><strong>Pro ($12/month):</strong> Unlimited bookings, AI queries, and magic links</li>
              <li><strong>Team ($25/month):</strong> All Pro features plus team scheduling for up to 10 members</li>
            </ul>
            <p className="text-gray-600 mb-6">
              Paid subscriptions are billed monthly. You may cancel at any time, and your subscription will remain active until the end of the billing period.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Acceptable Use</h2>
            <p className="text-gray-600 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Send spam or unsolicited communications</li>
              <li>Impersonate others or misrepresent your affiliation</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Use automated systems to access the Service without permission</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. Intellectual Property</h2>
            <p className="text-gray-600 mb-6">
              The Service, including its design, features, and content, is owned by ScheduleSync and protected by intellectual property laws. 
              You retain ownership of content you create using the Service.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">7. Limitation of Liability</h2>
            <p className="text-gray-600 mb-6">
              To the maximum extent permitted by law, ScheduleSync shall not be liable for any indirect, incidental, special, 
              consequential, or punitive damages, including lost profits, data loss, or business interruption, 
              arising from your use of the Service.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-gray-600 mb-6">
              The Service is provided "as is" without warranties of any kind, express or implied. 
              We do not guarantee that the Service will be uninterrupted, secure, or error-free.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">9. Changes to Terms</h2>
            <p className="text-gray-600 mb-6">
              We may update these Terms from time to time. We will notify you of significant changes by email or through the Service. 
              Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">10. Termination</h2>
            <p className="text-gray-600 mb-6">
              We reserve the right to suspend or terminate your account if you violate these Terms. 
              Upon termination, your right to use the Service will immediately cease.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">11. Contact</h2>
            <p className="text-gray-600 mb-6">
              For questions about these Terms, please contact us at:{' '}
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