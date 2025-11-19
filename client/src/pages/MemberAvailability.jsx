import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, DollarSign } from 'lucide-react';
import AvailabilitySettings from '../components/AvailabilitySettings';
import MemberPricingSettings from '../components/MemberPricingSettings';

export default function MemberAvailability() {
  const { teamId, memberId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('availability');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/teams/${teamId}`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Member Settings</h1>
          <p className="text-gray-600 mt-1">Configure availability and pricing</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('availability')}
            className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'availability'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="h-5 w-5" />
            Availability
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'pricing'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="h-5 w-5" />
            Pricing
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'availability' && (
        <AvailabilitySettings teamId={teamId} memberId={memberId} />
      )}
      
      {activeTab === 'pricing' && (
        <MemberPricingSettings teamId={teamId} memberId={memberId} />
      )}
    </div>
  );
}