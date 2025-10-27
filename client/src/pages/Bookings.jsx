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
      setBookingsList(response.data.bookings || []);
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
              <div key={booking.id} className="p-6 hover:bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">
                  {booking.title || 'Booking'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(booking.start_time).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}