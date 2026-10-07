import React from 'react';

interface ConversasIconProps {
  className?: string;
}

export const ConversasIcon: React.FC<ConversasIconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-13 -9 26 22"
      className={className}
    >
      <path
        d="M-9-8 H7 A3 3 0 0 1 10-5 V4 A3 3 0 0 1 7 7 H-3 L-9 11 V7 A3 3 0 0 1-12 4 V-5 A3 3 0 0 1-9-8Z"
        fill="currentColor"
      />
      <circle cx="-5" cy="-0.5" r="1.2" fill="#FFFFFF" />
      <circle cx="-1" cy="-0.5" r="1.2" fill="#FFFFFF" />
      <circle cx="3" cy="-0.5" r="1.2" fill="#FFFFFF" />
    </svg>
  );
};

