import React from 'react';

interface HistoryIconProps {
  className?: string;
}

export const HistoryIcon: React.FC<HistoryIconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-11 -10 22 21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="0" cy="0" r="7" />
      <path d="M0 -4 V0 L3 2" />
      <path d="M-9 -2 A10 10 0 0 0 -3 9" />
    </svg>
  );
};

