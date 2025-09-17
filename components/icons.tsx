
import React from 'react';

export const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5.4-3a5.4 5.4 0 0 1-10.8 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-1.6z"/>
  </svg>
);

export const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h12v12H6z"/>
  </svg>
);

export const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

export const GeminiIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.75 2.75c0 .966-.784 1.75-1.75 1.75a1.75 1.75 0 1 1 0-3.5c.966 0 1.75.784 1.75 1.75M19.25 11c0 .966-.784 1.75-1.75 1.75s-1.75-.784-1.75-1.75.784-1.75 1.75-1.75 1.75.784 1.75 1.75M16.5 19.25c.966 0 1.75.784 1.75 1.75s-.784 1.75-1.75 1.75-1.75-.784-1.75-1.75.784-1.75 1.75-1.75M10.05 15.908c-.282.49-.785.83-1.373.892L2.04 17.846a1 1 0 0 1-1.04-1.385l3.1-8.913a1 1 0 0 1 1.257-.653l5.06 1.757c.225.078.43.21.608.38l6.19 5.865a1.5 1.5 0 0 1-2.083 2.158l-5.08-4.814-1.008 2.894Z" />
    </svg>
);
