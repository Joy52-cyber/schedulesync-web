import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Calendar, Zap, Share2, Users, Clock, CheckCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      
      {/* HEADER */}
      <header className="border-b border-purple-100 bg-white/70 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold">ScheduleSync</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost">Log in</Button>
            </Link>

            <Link to="/register">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                Start free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            Transform Your Scheduling Experience
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Scheduling that actually works for you — not the other way around.
          </h1>

          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Connect calendars, share your booking link, and streamline your workflow
            with ease. No confusion. No double bookings. Just simple, smart scheduling.
          </p>

          {/* Email capture */}
          <div className="max-w-md mx-auto mb-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-white border-purple-200"
              />
              <Link to="/register">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-600">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-purple-600 hover:text-purple-800">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 py-10">
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-purple-100">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Calendar Integration</h3>
              <p className="text-sm text-gray-600">
                Connect Google Calendar, Outlook, and more into one unified experience.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-purple-100">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Smart Availability</h3>
              <p className="text-sm text-gray-600">
                Avoid conflicts with automatic syncing across all your calendars.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-purple-100">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Share2 className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Easy Sharing</h3>
              <p className="text-sm text-gray-600">
                Share your personalized link and let people book instantly.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="container mx-auto px-4 py-16 mb-16">
        <Card className="border-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="max-w-2xl mx-auto text-blue-50 mb-8">
              Join thousands of professionals who use ScheduleSync to streamline their
              workflow every day.
            </p>

            <div className="flex justify-center">
              <Link to="/register">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100">
                  Start free
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
