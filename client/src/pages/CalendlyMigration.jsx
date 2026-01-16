// client/src/pages/CalendlyMigration.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Calendar,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  ExternalLink,
  Download,
  Trash2,
  Sparkles,
  Users,
  Clock,
} from 'lucide-react';
import api from '../utils/api';

export default function CalendlyMigration() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1); // 1: Instructions, 2: Import, 3: Review, 4: Complete
  const [apiKey, setApiKey] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Calendly API key');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const response = await api.post('/import/calendly', {
        api_key: apiKey,
        import_event_types: true,
        import_availability: true,
        import_bookings_days: 90, // Last 90 days
      });

      setImportResults(response.data);
      setStep(3);
    } catch (err) {
      console.error('Import error:', err);
      setError(
        err.response?.data?.error || 
        'Failed to import from Calendly. Please check your API key and try again.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleComplete = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-6 shadow-lg">
            <Upload className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Migrate from Calendly
          </h1>
          <p className="text-lg text-gray-600">
            Import your event types, availability settings, and booking history in minutes
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-purple-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step >= 1 ? 'bg-purple-600 text-white' : 'bg-gray-200'
              }`}>
                1
              </div>
              <span className="text-sm font-medium hidden sm:inline">Setup</span>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-purple-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="text-sm font-medium hidden sm:inline">Import</span>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-purple-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step >= 3 ? 'bg-purple-600 text-white' : 'bg-gray-200'
              }`}>
                3
              </div>
              <span className="text-sm font-medium hidden sm:inline">Review</span>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${step >= 4 ? 'text-purple-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step >= 4 ? 'bg-purple-600 text-white' : 'bg-gray-200'
              }`}>
                4
              </div>
              <span className="text-sm font-medium hidden sm:inline">Complete</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-white/20 p-8">
          {/* STEP 1: Instructions */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Get Your Calendly API Key
                </h2>
                <p className="text-gray-600 mb-6">
                  Follow these steps to get your Calendly API key. Don't worry, it's safe and read-only!
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Visit Calendly Integrations</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Go to your Calendly account → Integrations → API & Webhooks
                    </p>
                    <a
                      href="https://calendly.com/integrations/api_webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Calendly Settings
                    </a>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Generate Personal Access Token</h3>
                    <p className="text-sm text-gray-600">
                      Click "Create Token" and copy it. Make sure to select "Read" permissions.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Paste Below & Import</h3>
                    <p className="text-sm text-gray-600">
                      Paste your token below and we'll import everything automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Security Note:</p>
                  <p>
                    We only use your API key once to import your data. We don't store it. 
                    After import, you can revoke the token in Calendly if you wish.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
                >
                  Next: Enter API Key
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Import */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Enter Your Calendly API Key
                </h2>
                <p className="text-gray-600">
                  Paste your Calendly Personal Access Token below to begin the import.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Calendly API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all font-mono text-sm"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="font-semibold text-blue-900 mb-2">What we'll import:</h3>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    Event types (meeting durations, descriptions, settings)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    Availability schedule (weekly hours)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    Past bookings (last 90 days for analytics)
                  </li>
                </ul>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !apiKey.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Start Import
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 3 && importResults && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Import Complete! 🎉
                </h2>
                <p className="text-gray-600">
                  We've successfully imported your Calendly data into ScheduleSync.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 bg-purple-50 rounded-xl border border-purple-200 text-center">
                  <Calendar className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                  <p className="text-3xl font-bold text-purple-900 mb-1">
                    {importResults.event_types || 0}
                  </p>
                  <p className="text-sm text-purple-700">Event Types</p>
                </div>

                <div className="p-6 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <Clock className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <p className="text-3xl font-bold text-blue-900 mb-1">
                    {importResults.availability_rules || 0}
                  </p>
                  <p className="text-sm text-blue-700">Availability Rules</p>
                </div>

                <div className="p-6 bg-green-50 rounded-xl border border-green-200 text-center">
                  <Users className="h-8 w-8 text-green-600 mx-auto mb-3" />
                  <p className="text-3xl font-bold text-green-900 mb-1">
                    {importResults.bookings || 0}
                  </p>
                  <p className="text-sm text-green-700">Past Bookings</p>
                </div>
              </div>

              {importResults.warnings && importResults.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-yellow-900 mb-2">Import Notes:</h3>
                      <ul className="space-y-1 text-sm text-yellow-800">
                        {importResults.warnings.map((warning, idx) => (
                          <li key={idx}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  What's Next?
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Review your imported event types in the dashboard</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Customize your availability settings if needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Update your booking links on your website/social media</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Trash2 className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">Optional: Cancel your Calendly subscription and delete your account</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={handleComplete}
                  className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-bold text-lg flex items-center gap-2"
                >
                  Go to Dashboard
                  <ArrowRight className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Need help?{' '}
            <a href="mailto:support@schedulesync.com" className="text-purple-600 hover:text-purple-700 font-medium">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}