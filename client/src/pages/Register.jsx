// client/src/pages/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../utils/api";
import { Calendar } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await auth.register(form);
      if (res.data.success) {
        navigate("/login");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Animated Background Blobs */}
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
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      {/* Card */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-xl shadow-xl border-2 border-white/20 p-8 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-2 shadow-lg">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Create your account
          </h2>
          <p className="text-sm text-gray-500">
            Start using ScheduleSync for free
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          {/* Name */}
          <input
            name="name"
            placeholder="Full name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2.5 rounded-lg border bg-white border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
          />

          {/* Email */}
          <input
            name="email"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2.5 rounded-lg border bg-white border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
          />

          {/* Password */}
          <input
            name="password"
            type="password"
            placeholder="Create a password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full px-3 py-2.5 rounded-lg border bg-white border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-2xl hover:shadow-purple-200/50 hover:-translate-y-0.5 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Log in
          </Link>
        </p>

        {/* Subnote */}
        <p className="text-center text-xs text-gray-500 mt-3">
          No credit card required
        </p>
      </div>
    </div>
  );
}
