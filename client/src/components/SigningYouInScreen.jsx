import { Calendar } from 'lucide-react';

function SpinnerRing() {
  return (
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 rounded-full border border-purple-200/60" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-600 border-r-purple-400 animate-spin" />
      <div className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-purple-100/60" />
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" />
    </span>
  );
}

export default function SigningYouInScreen() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-purple-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div className="text-2xl font-bold text-gray-900">TruCal</div>
        </div>

        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <SpinnerRing />
        </div>

        {/* Text */}
        <div className="text-gray-900 text-lg font-medium">
          Signing you in<LoadingDots />
        </div>

        {/* Secure pill */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-4 py-2 text-sm text-gray-600 shadow-sm">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-50">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-600">
                <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M8.5 12.5l2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Secure connection
          </div>
        </div>
      </div>
    </div>
  );
}
