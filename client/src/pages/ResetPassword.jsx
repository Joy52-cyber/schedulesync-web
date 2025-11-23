import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { auth } from "../utils/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Calendar } from "lucide-react";

function useQueryToken() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  return params.get("token");
}

export default function ResetPassword() {
  const token = useQueryToken();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Reset link is invalid or missing.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await auth.resetPassword(token, password);
      setDone(true);
      // Optional auto-redirect after a short delay
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "We couldn't reset your password. The link may have expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-xl shadow-xl border border-purple-100 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-2 shadow-md">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Create a new password
          </h2>
          <p className="text-sm text-gray-500 text-center">
            Choose a strong password you don&apos;t use elsewhere.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          {done && !error && (
            <div className="p-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
              Your password has been reset. Redirecting you to login…
            </div>
          )}

          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-white border-purple-200 focus:border-purple-400"
          />

          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="bg-white border-purple-200 focus:border-purple-400"
          />

          <Button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {loading ? "Updating password..." : "Reset password"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Back to{" "}
          <Link
            to="/login"
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            login
          </Link>
        </p>
      </div>
    </div>
  );
}
