import React from 'react';

interface ContactsIconProps {
  className?: string;
  outline?: boolean;
}

export const ContactsIcon: React.FC<ContactsIconProps> = ({ className = 'w-5 h-5', outline = false }) => {
  if (outline) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-9 -9 18 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className={className}
      >
        <circle cx="0" cy="-4" r="3.5" />
        <path d="M-7 8 V5 A7 7 0 0 1 7 5 V8" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="285 617 20 23"
      fill="currentColor"
      className={className}
    >
      <circle cx="295" cy="623" r="4" />
      <path d="M287 638 V635 A8 8 0 0 1 303 635 V638Z" />
    </svg>
  );
};

