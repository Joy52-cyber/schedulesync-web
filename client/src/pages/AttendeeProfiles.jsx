import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Calendar,
  Clock,
  TrendingUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  X,
  FileText,
  Mail,
  Building,
  Briefcase,
} from 'lucide-react';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

export default function AttendeeProfiles() {
  const navigate = useNavigate();
  const notify = useNotification();

  const [attendees, setAttendees] = useState([]);
  const [filteredAttendees, setFilteredAttendees] = useState([]);
  const [stats, setStats] = useState({ totalAttendees: 0, totalMeetings: 0, avgMeetings: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('meeting_count_desc');
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [attendeeDetails, setAttendeeDetails] = useState(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    loadAttendees();
  }, []);

  const loadAttendees = async () => {
    try {
      setLoading(true);
      const [attendeesRes, statsRes] = await Promise.all([
        api.attendees.getAll(),
        api.attendees.getStats(),
      ]);

      setAttendees(attendeesRes.data || []);
      setStats(statsRes.data || { totalAttendees: 0, totalMeetings: 0, avgMeetings: 0 });
    } catch (error) {
      console.error('Failed to load attendees:', error);
      notify.error('Failed to load attendee profiles');
    } finally {
      setLoading(false);
    }
  };

  // Apply search and sort
  useEffect(() => {
    let filtered = [...attendees];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name?.toLowerCase().includes(term) ||
          a.email?.toLowerCase().includes(term) ||
          a.company?.toLowerCase().includes(term)
      );
    }

    // Sort
    switch (sortBy) {
      case 'meeting_count_desc':
        filtered.sort((a, b) => b.meeting_count - a.meeting_count);
        break;
      case 'meeting_count_asc':
        filtered.sort((a, b) => a.meeting_count - b.meeting_count);
        break;
      case 'last_meeting_desc':
        filtered.sort((a, b) => new Date(b.last_meeting_date) - new Date(a.last_meeting_date));
        break;
      case 'last_meeting_asc':
        filtered.sort((a, b) => new Date(a.last_meeting_date) - new Date(b.last_meeting_date));
        break;
      case 'total_time_desc':
        filtered.sort((a, b) => b.total_meeting_minutes - a.total_meeting_minutes);
        break;
      case 'total_time_asc':
        filtered.sort((a, b) => a.total_meeting_minutes - b.total_meeting_minutes);
        break;
      case 'name_asc':
        filtered.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
        break;
      default:
        break;
    }

    setFilteredAttendees(filtered);
  }, [attendees, searchTerm, sortBy]);

  const loadAttendeeDetails = async (email) => {
    try {
      setDetailLoading(true);
      const response = await api.attendees.getByEmail(email);
      setAttendeeDetails(response.data);
      setNotes(response.data.profile?.notes || '');
    } catch (error) {
      console.error('Failed to load attendee details:', error);
      notify.error('Failed to load attendee details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDetails = (attendee) => {
    setSelectedAttendee(attendee);
    loadAttendeeDetails(attendee.email);
  };

  const handleCloseDetails = () => {
    setSelectedAttendee(null);
    setAttendeeDetails(null);
    setNotes('');
  };

  const handleSaveNotes = async () => {
    if (!selectedAttendee) return;

    try {
      setSavingNotes(true);
      await api.attendees.updateNotes(selectedAttendee.email, notes);

      // Update local state
      setAttendees(prev =>
        prev.map(a =>
          a.email === selectedAttendee.email
            ? { ...a, notes }
            : a
        )
      );

      if (attendeeDetails) {
        setAttendeeDetails({
          ...attendeeDetails,
          profile: { ...attendeeDetails.profile, notes }
        });
      }

      notify.success('Notes saved successfully');
    } catch (error) {
      console.error('Failed to save notes:', error);
      notify.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg relative z-10">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-xl">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Relationship Insights</h1>
                <p className="text-gray-500 text-sm">Manage your attendee relationships</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Attendees</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalAttendees || filteredAttendees.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Meetings</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalMeetings || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Avg Meetings/Attendee</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.avgMeetings ? stats.avgMeetings.toFixed(1) : '0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
              />
            </div>

            <div className="relative min-w-[200px]">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all cursor-pointer"
              >
                <option value="meeting_count_desc">Most Meetings</option>
                <option value="meeting_count_asc">Fewest Meetings</option>
                <option value="last_meeting_desc">Recently Met</option>
                <option value="last_meeting_asc">Least Recently Met</option>
                <option value="total_time_desc">Most Time Spent</option>
                <option value="total_time_asc">Least Time Spent</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Attendees Grid */}
        {filteredAttendees.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-12 border border-white/20 shadow-xl text-center">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium text-lg">No attendees found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm ? 'Try adjusting your search' : 'Your attendee relationships will appear here'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAttendees.map((attendee) => (
              <div
                key={attendee.email}
                onClick={() => handleViewDetails(attendee)}
                className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border-2 border-gray-200 hover:border-purple-400 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold shadow-md flex-shrink-0">
                    {getInitials(attendee.name, attendee.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">
                      {attendee.name || attendee.email}
                    </h3>
                    {attendee.name && (
                      <p className="text-sm text-gray-600 truncate">{attendee.email}</p>
                    )}
                    {attendee.company && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{attendee.company}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Meetings
                    </span>
                    <span className="font-semibold text-purple-600">
                      {attendee.meeting_count || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Total Time
                    </span>
                    <span className="font-semibold text-blue-600">
                      {formatDuration(attendee.total_meeting_minutes || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Last Met
                    </span>
                    <span className="font-semibold text-green-600">
                      {formatDate(attendee.last_meeting_date)}
                    </span>
                  </div>
                </div>

                {attendee.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 flex items-start gap-1">
                      <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{attendee.notes}</span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedAttendee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 p-8 rounded-t-3xl shadow-lg z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Attendee Details</h2>
                <button
                  onClick={handleCloseDetails}
                  className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-3xl font-bold">
                  {getInitials(selectedAttendee.name, selectedAttendee.email)}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white">
                    {selectedAttendee.name || selectedAttendee.email}
                  </h3>
                  <p className="text-purple-100 flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    {selectedAttendee.email}
                  </p>
                  {(selectedAttendee.company || selectedAttendee.title) && (
                    <div className="flex items-center gap-3 mt-2 text-sm text-purple-100">
                      {selectedAttendee.company && (
                        <span className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {selectedAttendee.company}
                        </span>
                      )}
                      {selectedAttendee.title && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-4 w-4" />
                          {selectedAttendee.title}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 text-center border border-purple-100">
                      <Calendar className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{selectedAttendee.meeting_count || 0}</p>
                      <p className="text-xs text-gray-600 font-medium">Meetings</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center border border-blue-100">
                      <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">
                        {formatDuration(selectedAttendee.total_meeting_minutes || 0)}
                      </p>
                      <p className="text-xs text-gray-600 font-medium">Total Time</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-100">
                      <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                      <p className="text-sm font-bold text-gray-900">
                        {formatDate(selectedAttendee.last_meeting_date)}
                      </p>
                      <p className="text-xs text-gray-600 font-medium">Last Met</p>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Notes about {selectedAttendee.name || 'this person'}
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes about your relationship, preferences, or conversation topics..."
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all min-h-[120px]"
                    />
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {savingNotes ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Notes'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Recent Meetings */}
                  {attendeeDetails?.recentMeetings && attendeeDetails.recentMeetings.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-purple-600" />
                        Recent Meetings
                      </h4>
                      <div className="space-y-2">
                        {attendeeDetails.recentMeetings.map((meeting) => (
                          <div
                            key={meeting.id}
                            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-all cursor-pointer"
                            onClick={() => {
                              navigate(`/bookings?id=${meeting.id}`);
                              handleCloseDetails();
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{meeting.title || 'Meeting'}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {new Date(meeting.start_time).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                  {' • '}
                                  {new Date(meeting.start_time).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                meeting.status === 'confirmed'
                                  ? 'bg-green-100 text-green-800'
                                  : meeting.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {meeting.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
