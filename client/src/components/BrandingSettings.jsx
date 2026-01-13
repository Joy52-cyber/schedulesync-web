import { useState, useEffect, useRef } from 'react';
import { 
  Palette, 
  Image, 
  Eye, 
  EyeOff, 
  Save, 
  Loader2, 
  Lock,
  Check,
  RefreshCw,
  Sparkles,
  Upload,
  AlertCircle,
  Clock,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { useUpgrade } from '../context/UpgradeContext';
import api from '../utils/api';

export default function BrandingSettings() {
  const { hasProFeature, showUpgradeModal, currentTier, loading: tierLoading } = useUpgrade();
  
  const [branding, setBranding] = useState({
    brand_logo_url: '',
    brand_primary_color: '#8B5CF6',
    brand_accent_color: '#EC4899',
    hide_powered_by: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewStep, setPreviewStep] = useState('event-select'); // Toggle preview between steps
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const response = await api.get('/user/branding');
      if (response.data) {
        setBranding({
          brand_logo_url: response.data.brand_logo_url || '',
          brand_primary_color: response.data.brand_primary_color || '#8B5CF6',
          brand_accent_color: response.data.brand_accent_color || '#EC4899',
          hide_powered_by: response.data.hide_powered_by || false,
        });
      }
    } catch (err) {
      console.error('Failed to fetch branding:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a PNG, JPG, SVG, or WebP image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await api.post('/user/branding/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.logo_url) {
        setBranding(prev => ({ ...prev, brand_logo_url: response.data.logo_url }));
      }
    } catch (err) {
      console.error('Failed to upload logo:', err);
      setUploadError(err.response?.data?.error || 'Failed to upload logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setBranding(prev => ({ ...prev, brand_logo_url: '' }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      await api.put('/user/branding', branding);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save branding:', err);
      setError(err.response?.data?.error || 'Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setBranding({
      brand_logo_url: '',
      brand_primary_color: '#8B5CF6',
      brand_accent_color: '#EC4899',
      hide_powered_by: false,
    });
  };

  const presetColors = [
    { primary: '#8B5CF6', accent: '#EC4899', name: 'Purple Pink' },
    { primary: '#3B82F6', accent: '#06B6D4', name: 'Blue Cyan' },
    { primary: '#10B981', accent: '#34D399', name: 'Green' },
    { primary: '#F59E0B', accent: '#F97316', name: 'Orange' },
    { primary: '#EF4444', accent: '#F43F5E', name: 'Red Rose' },
    { primary: '#6366F1', accent: '#8B5CF6', name: 'Indigo' },
    { primary: '#000000', accent: '#374151', name: 'Monochrome' },
  ];

  if (tierLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!hasProFeature()) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Custom Branding</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Make your booking pages match your brand with custom logos, colors, and remove the "Powered by" badge.
        </p>
        
        <div className="bg-gray-50 rounded-xl p-6 mb-6 max-w-sm mx-auto text-left">
          <h3 className="font-semibold text-gray-900 mb-3">Pro features include:</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Custom logo on booking pages
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Custom brand colors
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Hide "Powered by ScheduleSync"
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Professional appearance
            </li>
          </ul>
        </div>

        <button
          onClick={() => showUpgradeModal('branding')}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          Upgrade to Pro - $15/month
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Palette className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Custom Branding</h2>
            <p className="text-sm text-gray-500">Personalize your booking pages</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
          {currentTier === 'team' ? 'Team' : 'Pro'}
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Settings Column */}
        <div className="space-y-6">
          {/* Logo Upload */}
          <div className="bg-gray-50 rounded-xl p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Image className="h-4 w-4 inline mr-2" />
              Logo
            </label>
            
            {branding.brand_logo_url ? (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white rounded-xl border-2 border-gray-200 flex items-center justify-center overflow-hidden">
                  <img 
                    src={branding.brand_logo_url} 
                    alt="Logo preview" 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">Logo uploaded</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Change
                    </button>
                    <button
                      onClick={handleRemoveLogo}
                      className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all"
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-2" />
                    <p className="text-sm text-gray-600">Uploading...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Click to upload logo</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, SVG or WebP (max 2MB)</p>
                  </>
                )}
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {uploadError && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {uploadError}
              </p>
            )}
            
            <p className="mt-3 text-xs text-gray-500">
              Recommended: Square image, at least 200x200px. Transparent background works best.
            </p>
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Sparkles className="h-4 w-4 inline mr-2" />
              Color Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setBranding({
                    ...branding,
                    brand_primary_color: preset.primary,
                    brand_accent_color: preset.accent,
                  })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                    branding.brand_primary_color === preset.primary && branding.brand_accent_color === preset.accent
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div 
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
                  />
                  <span className="text-xs font-medium text-gray-700">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.brand_primary_color}
                  onChange={(e) => setBranding({ ...branding, brand_primary_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.brand_primary_color}
                  onChange={(e) => setBranding({ ...branding, brand_primary_color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500"
                  placeholder="#8B5CF6"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Accent Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.brand_accent_color}
                  onChange={(e) => setBranding({ ...branding, brand_accent_color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.brand_accent_color}
                  onChange={(e) => setBranding({ ...branding, brand_accent_color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500"
                  placeholder="#EC4899"
                />
              </div>
            </div>
          </div>

          {/* Hide Powered By */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              {branding.hide_powered_by ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-600" />
              )}
              <div>
                <div className="font-semibold text-gray-900 text-sm">Hide "Powered by ScheduleSync"</div>
                <p className="text-xs text-gray-500">Remove branding from your booking pages</p>
              </div>
            </div>
            <button
              onClick={() => setBranding({ ...branding, hide_powered_by: !branding.hide_powered_by })}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                branding.hide_powered_by ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  branding.hide_powered_by ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Reset to Default
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all text-sm ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
              } disabled:opacity-50`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========== ACCURATE PREVIEW - Matches BookingPage.jsx ========== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-700">
              Live Preview
            </label>
            {/* Preview step toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPreviewStep('event-select')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  previewStep === 'event-select' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Step 1
              </button>
              <button
                onClick={() => setPreviewStep('form')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  previewStep === 'form' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Step 2
              </button>
            </div>
          </div>
          
          <div className="bg-slate-100 rounded-xl p-3 sticky top-4">
            {/* Exact BookingPage Layout */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex min-h-[380px] border border-slate-100">
              
              {/* ===== LEFT SIDEBAR - matches BookingPage ===== */}
              <div className="w-[38%] bg-slate-50 border-r border-slate-200 p-4 flex flex-col">
                <div className="flex-1">
                  {/* Branded Avatar/Logo */}
                  {branding.brand_logo_url ? (
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg mb-3 bg-white border border-slate-200">
                      <img 
                        src={branding.brand_logo_url} 
                        alt="Logo" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-lg mb-3"
                      style={{ background: `linear-gradient(135deg, ${branding.brand_primary_color}, ${branding.brand_accent_color})` }}
                    >
                      Y
                    </div>
                  )}
                  
                  <p className="text-slate-500 font-medium text-xs">Book a meeting with</p>
                  <h2 className="text-base font-bold text-slate-900">Your Name</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Your Team</p>

                  {/* Event type info - shown when selected */}
                  {previewStep === 'form' && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-1">30 Minute Meeting</h3>
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                          <Clock className="h-3 w-3" />
                          <span className="font-medium">30 min</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        A quick call to discuss your needs and answer questions.
                      </p>
                    </div>
                  )}

                  {/* Prompt when no event selected */}
                  {previewStep === 'event-select' && (
                    <div 
                      className="mt-4 p-3 rounded-xl border text-xs"
                      style={{ 
                        backgroundColor: branding.brand_primary_color + '10',
                        borderColor: branding.brand_primary_color + '30',
                        color: branding.brand_primary_color
                      }}
                    >
                      Select a meeting type to continue.
                    </div>
                  )}
                </div>
                
                {/* Powered by footer */}
                {!branding.hide_powered_by && (
                  <div className="pt-4 text-[10px] text-slate-300 font-medium">
                    Powered by ScheduleSync
                  </div>
                )}
              </div>

              {/* ===== RIGHT CONTENT AREA - matches BookingPage ===== */}
              <div className="w-[62%] bg-white p-4 overflow-hidden">
                
                {/* Step 1: Event Type Selection */}
                {previewStep === 'event-select' && (
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 mb-1">Select a Meeting Type</h2>
                    <p className="text-slate-500 text-xs mb-4">Choose the type of meeting you'd like to schedule.</p>
                    
                    <div className="space-y-2">
                      {['30 Minute Meeting', 'Quick Chat', 'Consultation'].map((title, idx) => (
                        <div
                          key={idx}
                          className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 transition-all cursor-pointer hover:shadow-md"
                          style={{ 
                            borderColor: idx === 0 ? branding.brand_primary_color : '#e2e8f0',
                          }}
                        >
                          <div 
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                            style={{ 
                              backgroundColor: branding.brand_primary_color + '20',
                              color: branding.brand_primary_color
                            }}
                          >
                            <Clock className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-xs">{title}</h3>
                            <p className="text-slate-500 text-[10px]">{idx === 0 ? '30' : idx === 1 ? '15' : '60'} minutes</p>
                          </div>
                          <ChevronRight 
                            className="h-4 w-4 transition-transform group-hover:translate-x-1"
                            style={{ color: branding.brand_primary_color }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2: Form with selected time */}
                {previewStep === 'form' && (
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 mb-3">Finalize Booking</h2>
                    
                    {/* Selected Time Box - branded */}
                    <div 
                      className="rounded-xl p-3 mb-4 flex justify-between items-center border"
                      style={{ 
                        backgroundColor: branding.brand_primary_color + '15',
                        borderColor: branding.brand_primary_color + '30'
                      }}
                    >
                      <div>
                        <p 
                          className="text-[10px] font-bold uppercase tracking-wide"
                          style={{ color: branding.brand_primary_color }}
                        >
                          Selected Time
                        </p>
                        <p className="font-semibold text-xs mt-0.5" style={{ color: branding.brand_primary_color }}>
                          Monday, January 15
                        </p>
                        <p className="text-[10px]" style={{ color: branding.brand_primary_color + 'cc' }}>
                          10:00 AM - 10:30 AM
                        </p>
                      </div>
                      <button 
                        className="text-[10px] font-medium underline"
                        style={{ color: branding.brand_primary_color }}
                      >
                        Change
                      </button>
                    </div>

                    {/* Form fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-700 mb-1">Your Name</label>
                        <div className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-400">
                          John Doe
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-700 mb-1">Email Address</label>
                        <div className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-400">
                          john@example.com
                        </div>
                      </div>
                    </div>

                    {/* Confirm Button - branded */}
                    <button
                      className="w-full mt-4 text-white py-2.5 rounded-xl font-bold text-xs cursor-default"
                      style={{ backgroundColor: branding.brand_primary_color }}
                    >
                      Confirm Booking
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-gray-500 text-center mt-2">
              This preview matches your actual booking page layout
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}