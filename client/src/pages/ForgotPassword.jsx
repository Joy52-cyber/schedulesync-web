import { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../utils/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Calendar } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSent(false);

    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "We couldn't send the reset link. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-xl shadow-xl border border-purple-100 p-8">
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-2 shadow-md">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Forgot your password?
          </h2>
          <p className="text-sm text-gray-500 text-center">
            Enter the email associated with your account and we&apos;ll send you
            a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          {sent && !error && (
            <div className="p-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
              If an account exists with that email, we&apos;ve sent a password
              reset link.
            </div>
          )}

          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-white border-purple-200 focus:border-purple-400"
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {loading ? "Sending reset link..." : "Send reset link"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Remembered your password?{" "}
          <Link
            to="/login"
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
