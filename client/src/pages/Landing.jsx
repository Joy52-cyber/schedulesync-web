import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Calendar, Zap, Share2 } from "lucide-react";
import LoginPanel from "../components/LoginPanel";
import { useState } from "react";

export default function Landing() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="border-b border-purple-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-800">ScheduleSync</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              className="text-gray-700 hover:text-gray-900 font-medium"
              onClick={() => setLoginOpen(true)}
            >
              Log in
            </button>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600">
              Start free
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Your scheduling, finally simplified.
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-8">
          Coordinate meetings, share your availability, and avoid double bookings—
          without the chaos.
        </p>

        <div className="flex max-w-md mx-auto gap-2">
          <Input placeholder="Enter your email" />
          <Button className="bg-gradient-to-r from-blue-500 to-purple-600">Get Started</Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-purple-100">
          <CardContent className="p-6 text-center">
            <Calendar className="w-10 h-10 text-blue-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Calendar Integration</h3>
            <p className="text-sm text-gray-600">
              Sync Google Calendar, Outlook, and more.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-purple-100">
          <CardContent className="p-6 text-center">
            <Zap className="w-10 h-10 text-green-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Smart Availability</h3>
            <p className="text-sm text-gray-600">
              Avoid conflicts and control your schedule.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-purple-100">
          <CardContent className="p-6 text-center">
            <Share2 className="w-10 h-10 text-purple-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Share Instantly</h3>
            <p className="text-sm text-gray-600">
              Send your booking link and get meetings booked.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Floating Login Panel */}
      <LoginPanel isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
