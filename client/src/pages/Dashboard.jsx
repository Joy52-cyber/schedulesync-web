import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Users, BookOpen, TrendingUp, RefreshCw } from 'lucide-react';
import { calendar, analytics } from '../utils/api';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ totalBookings: 0, upcomingBookings: 0, totalTeams: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      
      const [eventsRes, analyticsRes] = await Promise.all([
        calendar.getEvents(),
        analytics.get()
      ]);
      setEvents(eventsRes.data.events || []);
      setStats(analyticsRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatEventTime = (event) => {
    if (event.provider === 'google') {
      const start = new Date(event.start?.dateTime || event.start?.date);
      return start.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } else if (event.provider === 'microsoft') {
      const start = new Date(event.start?.dateTime);
      return start.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
    return 'No time specified';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's your schedule overview</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="font-medium text-gray-700">Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalBookings}</p>
          <p className="text-sm text-gray-600">Bookings</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Coming Up</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{stats.upcomingBookings}</p>
          <p className="text-sm text-gray-600">Upcoming</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Active</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalTeams}</p>
          <p className="text-sm text-gray-600">Teams</p>
        </div>
      </div>

      {/* Calendar Events */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Events</h2>
                <p className="text-sm text-gray-500">Synced from your calendars</p>
              </div>
            </div>
            {events.length > 0 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {events.length} events
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <CalendarIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-900 font-medium mb-1">No upcoming events</p>
              <p className="text-sm text-gray-500">
                Connect your calendar to see your schedule here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 10).map((event, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className={`w-1 h-full rounded-full ${
                    event.provider === 'google' ? 'bg-blue-500' : 'bg-orange-500'
                  }`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {event.summary || event.subject || 'Untitled Event'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {formatEventTime(event)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        event.provider === 'google'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {event.provider === 'google' ? 'Google' : 'Microsoft'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}