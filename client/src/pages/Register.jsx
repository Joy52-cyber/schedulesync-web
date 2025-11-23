import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../utils/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 py-8">
      {/* Card */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-xl shadow-xl border border-purple-100 p-8">
        
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-2 shadow-md">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Create your account</h2>
          <p className="text-sm text-gray-500">Start using ScheduleSync for free</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          <Input
            name="name"
            placeholder="Full name"
            value={form.name}
            onChange={handleChange}
            required
            className="bg-white border-purple-200 focus:border-purple-400"
          />

          <Input
            name="email"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={handleChange}
            required
            className="bg-white border-purple-200 focus:border-purple-400"
          />

          <Input
            name="password"
            type="password"
            placeholder="Create a password"
            value={form.password}
            onChange={handleChange}
            required
            className="bg-white border-purple-200 focus:border-purple-400"
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
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
