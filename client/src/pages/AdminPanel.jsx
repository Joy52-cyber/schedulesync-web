import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Trash2, 
  Search, 
  ShieldAlert, 
  Loader2,
  Calendar,
  Mail
} from 'lucide-react';
import api from '../utils/api';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data.users);
      setSelectedUserIds([]);
    } catch (err) {
      console.error('Failed to load users:', err);
      if (err.response?.status === 403) {
        setError('Access Denied: You are not an admin.');
      } else {
        setError('Failed to load user list.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (
      !window.confirm(
        `Are you sure you want to PERMANENTLY delete ${userEmail}? This will remove all their teams and bookings. This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      // Optimistic update: remove from UI immediately
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSelectedUserIds((prev) => prev.filter((id) => id !== userId));

      await api.delete(`/admin/users/${userId}`);
      alert(`User ${userEmail} deleted successfully.`);
    } catch (err) {
      console.error('Delete failed:', err);
      alert(
        'Failed to delete user: ' +
          (err.response?.data?.error || err.message)
      );
      // Revert optimistic update on failure
      loadUsers();
    }
  };

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.name &&
      user.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allVisibleSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedUserIds.includes(u.id));

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      // Unselect all visible
      const visibleIds = filteredUsers.map((u) => u.id);
      setSelectedUserIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
    } else {
      // Add all visible
      const visibleIds = filteredUsers.map((u) => u.id);
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;

    const selectedUsers = users.filter((u) =>
      selectedUserIds.includes(u.id)
    );
    const emailList = selectedUsers.map((u) => u.email).join('\n');

    const confirmed = window.confirm(
      `You are about to PERMANENTLY delete ${selectedUserIds.length} user(s).\n\n` +
      `This will remove all their teams and bookings.\n` +
      `This CANNOT be undone.\n\n` +
      `Users:\n${emailList}\n\nContinue?`
    );

    if (!confirmed) return;

    try {
      setBulkDeleting(true);

      // Optimistic update
      setUsers((prev) =>
        prev.filter((u) => !selectedUserIds.includes(u.id))
      );

      await Promise.all(
        selectedUserIds.map((userId) =>
          api.delete(`/admin/users/${userId}`)
        )
      );

      alert(`Deleted ${selectedUserIds.length} user(s) successfully.`);
      setSelectedUserIds([]);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      alert(
        'Failed to delete some users: ' +
          (err.response?.data?.error || err.message)
      );
      loadUsers();
    } finally {
      setBulkDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
        `}</style>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="relative z-10">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4 relative overflow-hidden">
        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob {
            animation: blob 7s infinite;
          }
          .animation-delay-2000 {
            animation-delay: 2s;
          }
          .animation-delay-4000 {
            animation-delay: 4s;
          }
        `}</style>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl text-center max-w-md border-2 border-white/20 relative z-10">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-2xl hover:shadow-purple-200/50 hover:-translate-y-0.5 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-6 sm:p-10 relative overflow-hidden">
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ShieldAlert className="text-purple-600" />
              Admin Panel
            </h1>
            <p className="text-gray-500 mt-1">
              Manage system users and data.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-white/80 backdrop-blur-xl px-4 py-2 rounded-xl border-2 border-white/20 shadow-lg text-sm font-medium text-gray-600">
              Total Users:{' '}
              <span className="text-gray-900 font-bold">
                {users.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedUserIds.length === 0 || bulkDeleting}
              className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                selectedUserIds.length === 0 || bulkDeleting
                  ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                  : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
              }`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {bulkDeleting
                ? 'Deleting...'
                : `Delete Selected (${selectedUserIds.length})`}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border-2 border-white/20 rounded-xl leading-5 bg-white/80 backdrop-blur-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm shadow-lg"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    User
                  </th>
                  <th
                    scope="col"
                    className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Stats
                  </th>
                  <th
                    scope="col"
                    className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Joined
                  </th>
                  <th
                    scope="col"
                    className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Provider
                  </th>
                  <th
                    scope="col"
                    className="relative px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleSelectUser(user.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {user.name?.[0] ||
                              user.email[0].toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.name || 'No Name'}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail size={12} /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Users size={12} className="mr-1" />{' '}
                          {user.team_count || 0} Teams
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Calendar size={12} className="mr-1" />{' '}
                          {user.booking_count || 0} Bookings
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span
                        className={`capitalize px-2 py-1 rounded-md text-xs border ${
                          user.provider === 'google'
                            ? 'bg-white border-gray-200'
                            : 'bg-gray-100'
                        }`}
                      >
                        {user.provider || 'Email'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() =>
                          handleDeleteUser(user.id, user.email)
                        }
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No users found matching your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
