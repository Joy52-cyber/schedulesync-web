import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { auth } from "../utils/api";
import { Button } from "../components/ui/button";
import { Calendar, CheckCircle2, XCircle } from "lucide-react";

function useQueryToken() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  return params.get("token");
}

export default function VerifyEmail() {
  const token = useQueryToken();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Verification link is invalid or missing.");
        return;
      }

      try {
        const res = await auth.verifyEmail(token);
        if (res.data.success) {
          setStatus("success");
          setMessage("Your email has been verified successfully!");
        } else {
          setStatus("error");
          setMessage(res.data.error || "We couldn't verify your email.");
        }
      } catch (err) {
        setStatus("error");
        setMessage(
          err.response?.data?.error ||
            "We couldn't verify your email. The link may have expired."
        );
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-xl shadow-xl border border-purple-100 p-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-2 shadow-md">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Verify your email
          </h2>
        </div>

        {/* Status icon + message */}
        <div className="mb-6 flex flex-col items-center gap-3">
          {status === "loading" && (
            <>
              <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-500 animate-spin" />
              <p className="text-sm text-gray-600">
                We&apos;re confirming your email address…
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-sm text-gray-700">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-red-600" />
              </div>
              <p className="text-sm text-gray-700">{message}</p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            asChild
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            <Link to="/login">Go to login</Link>
          </Button>

          <p className="text-xs text-gray-500">
            If you didn&apos;t create a ScheduleSync account, you can safely
            ignore this email.
          </p>
        </div>
      </div>
    </div>
  );
}
