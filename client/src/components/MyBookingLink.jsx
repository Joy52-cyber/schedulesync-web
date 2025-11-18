import { useState, useEffect } from 'react';
import { Link2, Copy, Check, ExternalLink, Calendar, Clock, Settings, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function MyBookingLink() {
  const [bookingUrl, setBookingUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBookingLink();
  }, []);

  const loadBookingLink = async () => {
    try {
      setLoading(true);
      const response = await api.get('/my-booking-link');
      setBookingUrl(response.data.bookingUrl);
      console.log('✅ Personal booking link loaded:', response.data.bookingUrl);
    } catch (err) {
      console.error('❌ Error loading booking link:', err);
      setError('Failed to load booking link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const openPreview = () => {
    window.open(bookingUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-gray-600">Generating your booking link...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadBookingLink}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
            <Calendar className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">My Booking Page</h2>
            <p className="text-blue-100 mt-1">Share this link so people can book time with you</p>
          </div>
        </div>
      </div>

      {/* Booking Link Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Your Personal Booking Link
        </label>
        
        <div className="flex gap-3">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-sm text-gray-700 overflow-x-auto">
            {bookingUrl}
          </div>
          
          <button
            onClick={copyToClipboard}
            className={`px-4 py-3 rounded-lg font-medium transition-all ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-5 w-5 inline mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-5 w-5 inline mr-2" />
                Copy
              </>
            )}
          </button>

          <button
            onClick={openPreview}
            className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <ExternalLink className="h-5 w-5 inline mr-2" />
            Preview
          </button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="bg-blue-100 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Calendar Integration</h3>
          <p className="text-sm text-gray-600">
            Bookings automatically sync with your Google Calendar to prevent conflicts
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="bg-green-100 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Smart Availability</h3>
          <p className="text-sm text-gray-600">
            Only shows available time slots based on your calendar and working hours
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="bg-purple-100 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
            <Settings className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Easy to Share</h3>
          <p className="text-sm text-gray-600">
            Add this link to your email signature, website, or social media profiles
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">📋 How to Use Your Booking Link</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[20px]">1.</span>
            <span><strong>Copy the link</strong> above and share it with clients or colleagues</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[20px]">2.</span>
            <span>People can <strong>choose a time</strong> that works for both of you</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[20px]">3.</span>
            <span>You'll receive <strong>email notifications</strong> when someone books</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold min-w-[20px]">4.</span>
            <span>Meetings automatically <strong>appear in your calendar</strong></span>
          </div>
        </div>
      </div>

      {/* Example Usage */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">💡 Where to Share Your Link</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 rounded-lg p-2">
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Email Signature</h4>
                <p className="text-sm text-gray-600">Add to your email footer for easy scheduling</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-green-100 rounded-lg p-2">
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Website</h4>
                <p className="text-sm text-gray-600">Add a "Book a Meeting" button on your site</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-purple-100 rounded-lg p-2">
                <svg className="h-5 w-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Social Media</h4>
                <p className="text-sm text-gray-600">Share in your LinkedIn or Twitter bio</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-orange-100 rounded-lg p-2">
                <svg className="h-5 w-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z"/>
                  <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Business Cards</h4>
                <p className="text-sm text-gray-600">Include QR code or short link on printed materials</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}