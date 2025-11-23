import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Zap,
  Share2,
  Users,
  Clock,
  CheckCircle,
} from 'lucide-react';
import LoginPanel from '../components/LoginPanel';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export default function Landing({ defaultLoginOpen = false }) {
  const [isLoginOpen, setIsLoginOpen] = useState(defaultLoginOpen);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Floating Login Panel */}
      <LoginPanel
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-purple-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm sm:text-base">
              ScheduleSync
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLoginOpen(true)}
              className="text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-xs sm:text-sm font-semibold text-white rounded-full px-3 sm:px-4 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-sm"
            >
              Start free
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-4 pt-8 pb-10">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center mb-3 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs sm:text-sm shadow-sm">
            Transform your scheduling in minutes
          </div>

          <h1 className="mb-3 text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
            One smart booking link for all your meetings
          </h1>

          <p className="text-sm sm:text-base text-gray-600 mb-5">
            Connect your calendars, share one link, and let ScheduleSync handle
            the availability, conflicts, and coordination.
          </p>

          {/* Email CTA */}
          <div className="max-w-md mx-auto flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Enter your work email"
              className="bg-white border-purple-200 text-sm"
            />
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-sm">
              Get started
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            Already have an account?{' '}
            <button
              className="text-purple-600 hover:text-purple-700 font-medium"
              onClick={() => setIsLoginOpen(true)}
            >
              Sign in
            </button>
          </p>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="max-w-5xl mx-auto px-4 pb-10">
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-white/85 backdrop-blur-sm border-purple-100 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150">
            <CardContent className="p-5">
              <Calendar className="w-7 h-7 text-blue-600 mb-2" />
              <h3 className="font-semibold text-sm mb-1">
                Calendar Integration
              </h3>
              <p className="text-xs text-gray-600">
                Connect Google Calendar, Outlook, and more in seconds.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/85 backdrop-blur-sm border-purple-100 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150">
            <CardContent className="p-5">
              <Zap className="w-7 h-7 text-green-600 mb-2" />
              <h3 className="font-semibold text-sm mb-1">Smart Availability</h3>
              <p className="text-xs text-gray-600">
                Auto-detect conflicts and show only slots that work.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/85 backdrop-blur-sm border-purple-100 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150">
            <CardContent className="p-5">
              <Share2 className="w-7 h-7 text-purple-600 mb-2" />
              <h3 className="font-semibold text-sm mb-1">Easy to Share</h3>
              <p className="text-xs text-gray-600">
                One booking link you can drop anywhere you talk to people.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* WHERE TO SHARE / USE CASES */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <h2 className="text-center text-sm sm:text-base font-semibold text-gray-900 mb-5">
          Where to share your link
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-white/85 backdrop-blur-sm border-purple-100">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-xs font-medium mb-1">Email signature</p>
              <p className="text-[11px] text-gray-600">
                Add it below your name for every message.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/85 backdrop-blur-sm border-purple-100">
            <CardContent className="p-4 text-center">
              <Share2 className="w-6 h-6 text-orange-500 mx-auto mb-2" />
              <p className="text-xs font-medium mb-1">Social profiles</p>
              <p className="text-[11px] text-gray-600">
                Drop it in your LinkedIn or bio link.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/85 backdrop-blur-sm border-purple-100">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-xs font-medium mb-1">Business cards</p>
              <p className="text-[11px] text-gray-600">
                Print a short URL or QR code.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/85 backdrop-blur-sm border-purple-100">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-xs font-medium mb-1">Website</p>
              <p className="text-[11px] text-gray-600">
                Embed it on your contact or pricing page.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-none shadow-md">
          <CardContent className="p-8 sm:p-10 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-2">
              Ready to simplify your scheduling?
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 mb-6">
              Join teams and solo professionals who use ScheduleSync to avoid
              back-and-forth emails and double bookings.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 text-sm"
                onClick={() => navigate('/register')}
              >
                Get started free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 text-sm"
              >
                Watch demo
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
