import React from 'react';

interface DialpadIconProps {
  className?: string;
}

export const DialpadIcon: React.FC<DialpadIconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="167 617 20 26"
      fill="currentColor"
      className={className}
    >
      <circle cx="171" cy="621" r="1.8" />
      <circle cx="177" cy="621" r="1.8" />
      <circle cx="183" cy="621" r="1.8" />
      <circle cx="171" cy="627" r="1.8" />
      <circle cx="177" cy="627" r="1.8" />
      <circle cx="183" cy="627" r="1.8" />
      <circle cx="171" cy="633" r="1.8" />
      <circle cx="177" cy="633" r="1.8" />
      <circle cx="183" cy="633" r="1.8" />
      <circle cx="177" cy="639" r="1.8" />
    </svg>
  );
};

