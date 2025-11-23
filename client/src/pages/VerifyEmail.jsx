// client/src/pages/VerifyEmail.jsx
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Calendar } from 'lucide-react';
import { auth } from '../utils/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }

      try {
        const res = await auth.verifyEmail(token);
        setStatus('success');
        setMessage(res.data?.message || 'Your email has been verified successfully.');
      } catch (err) {
        console.error('Verify error:', err);
        setStatus('error');
        setMessage(
          err.response?.data?.error ||
            'We could not verify your email. The link may have expired or already been used.'
        );
      }
    };

    run();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header / logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-lg">ScheduleSync</span>
        </div>

        {/* Card */}
        <div className="bg-white/90 border border-purple-100 shadow-lg rounded-2xl px-6 py-8 text-center">
          {status === 'loading' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Verifying your email…</h1>
              <p className="text-sm text-gray-600">
                Please wait while we confirm your email address.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Email verified</h1>
              <p className="text-sm text-gray-600 mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-purple-700 transition-colors"
              >
                Continue to login
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Verification failed</h1>
              <p className="text-sm text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-blue-600 hover:to-purple-700 transition-colors"
                >
                  Go to login
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Create a new account
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
