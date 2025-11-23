import LoginForm from '../components/LoginForm';

export default function Login({ onLogin }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/40 to-purple-50/40 px-4">
      <div className="w-full max-w-md">
        {/* Small logo/brand on top */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              SS
            </div>
            <span className="text-sm font-semibold text-gray-800">
              ScheduleSync
            </span>
          </div>
        </div>

        <LoginForm onLogin={onLogin} mode="page" />
      </div>
    </div>
  );
}
