import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { bookings } from '../utils/api';

export default function Bookings() {
  const [bookingsList, setBookingsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await bookings.getAll();
      setBookingsList(response.data?.bookings || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookingsList([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600 mt-1">Manage all your scheduled bookings</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {bookingsList.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-900 font-medium mb-1">No bookings found</p>
            <p className="text-sm text-gray-500">You have no bookings yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {bookingsList.map((booking) => (
              <div key={booking.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {booking.attendee_name || 'Booking'}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        📅 {new Date(booking.start_time).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p>
                        🕐 {new Date(booking.start_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {booking.attendee_email && (
                        <p>📧 {booking.attendee_email}</p>
                      )}
                      {booking.team_name && (
                        <p>👥 {booking.team_name}</p>
                      )}
                    </div>
                    {booking.notes && (
                      <p className="mt-2 text-sm text-gray-500 italic">
                        Note: {booking.notes}
                      </p>
                    )}
                  </div>
                  <div className="ml-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      booking.status === 'confirmed' 
                        ? 'bg-green-100 text-green-800'
                        : booking.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.status || 'pending'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}