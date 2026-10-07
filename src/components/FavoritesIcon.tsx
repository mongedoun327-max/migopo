import React from 'react';

interface FavoritesIconProps {
  className?: string;
}

export const FavoritesIcon: React.FC<FavoritesIconProps> = ({ className = 'w-5 h-5' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="286 597 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M300 600 L303 607 L311 608 L305 613 L307 621 L300 617 L293 621 L295 613 L289 608 L297 607 Z" />
    </svg>
  );
};

