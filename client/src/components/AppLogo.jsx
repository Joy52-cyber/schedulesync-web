import React from 'react';
import logo from '../assets/schedulesync-logo.png';

export default function AppLogo({ showText = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logo}
        alt="ScheduleSync"
        className="h-8 w-8 rounded-xl shadow-sm"
      />
      {showText && (
        <span className="font-semibold text-gray-900 text-base">
          ScheduleSync
        </span>
      )}
    </div>
  );
}
