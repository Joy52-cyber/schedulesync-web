import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  
  // Stripe redirects here with ?payment_intent_client_secret=...&redirect_status=succeeded
  const redirectStatus = searchParams.get('redirect_status');

  useEffect(() => {
    if (redirectStatus === 'succeeded') {
      setStatus('success');
      // Redirect to success page after a short delay
      setTimeout(() => navigate('/booking-success'), 3000);
    } else if (redirectStatus === 'failed') {
      setStatus('failed');
    } else {
      setStatus('processing');
    }
  }, [redirectStatus, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center">
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600">Redirecting you to your booking confirmation...</p>
          </>
        )}

        {status === 'failed' && (
          <>
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
            <p className="text-gray-600 mb-6">Something went wrong with your payment. Please try again.</p>
            <button 
              onClick={() => navigate(-1)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
            >
              Go Back
            </button>
          </>
        )}

        {status === 'processing' && (
          <>
             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <span className="text-3xl">⏳</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment...</h2>
            <p className="text-gray-600">Please wait while we confirm your transaction.</p>
          </>
        )}
      </div>
    </div>
  );
}