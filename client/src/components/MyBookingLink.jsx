import { useState, useEffect } from 'react';
import { Link2, Copy, Check, ExternalLink, Calendar, Clock, Settings, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function MyBookingLinks() {
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
      setError('');
      console.log('🔗 Loading booking link...');
      
      const response = await api.get('/my-booking-link');
      console.log('✅ Booking link response:', response.data);
      
      setBookingUrl(response.data.bookingUrl);
    } catch (err) {
      console.error('❌ Error loading booking link:', err);
      console.error('Error details:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to load booking link. Please try again.');
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
        <p className="text-red-800 font-semibold mb-2">Error Loading Booking Link</p>
        <p className="text-red-700 text-sm mb-4">{error}</p>
        <button
          onClick={loadBookingLink}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!bookingUrl) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <p className="text-yellow-800">No booking link available. Please contact support.</p>
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

      {/* Rest of the component stays the same... */}
      {/* Features Grid, Quick Actions, Example Usage sections */}
    </div>
  );
}