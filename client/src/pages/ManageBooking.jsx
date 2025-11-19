import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import SmartSlotPicker from '../components/SmartSlotPicker';
import { bookings } from '../utils/api'; // ⭐ ADD THIS IMPORT

const ManageBooking = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadBooking();
    
    const action = searchParams.get('action');
    if (action === 'reschedule') {
      setShowReschedule(true);
    } else if (action === 'cancel') {
      setShowCancel(true);
    }
  }, [token, searchParams]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const response = await bookings.getByManagementToken(token); // ⭐ CHANGED
      setBooking(response.data.booking);
    } catch (err) {
      console.error('Error loading booking:', err);
      setError(err.response?.data?.error || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (newSlot) => {
    console.log('🔄 Reschedule triggered with slot:', newSlot);
    
    if (!newSlot || !newSlot.start || !newSlot.end) {
      console.error('❌ Invalid slot data:', newSlot);
      alert('Please select a valid time slot');
      return;
    }

    try {
      setActionLoading(true);
      
      const response = await bookings.rescheduleByToken(token, { // ⭐ CHANGED
        newStartTime: newSlot.start,
        newEndTime: newSlot.end,
      });

      setBooking(response.data.booking);
      setShowReschedule(false);
      setSuccessMessage('🎉 Booking rescheduled successfully! Check your email for the updated calendar invite.');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('❌ Reschedule error:', err);
      alert(err.response?.data?.error || 'Failed to reschedule booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      
      await bookings.cancelByToken(token, { reason: cancelReason }); // ⭐ CHANGED

      setBooking({ ...booking, status: 'cancelled' });
      setShowCancel(false);
      setSuccessMessage('✅ Booking cancelled successfully. Both parties have been notified.');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('❌ Cancel error:', err);
      alert(err.response?.data?.error || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  // ... rest of your component (formatting functions, render, etc.)
};

export default ManageBooking;