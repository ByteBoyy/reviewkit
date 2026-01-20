import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-full h-full" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="currentColor" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="42" y="10" width="16" height="80" rx="2" />
      <rect x="10" y="42" width="80" height="16" rx="2" />
      <rect x="42" y="10" width="16" height="80" rx="2" transform="rotate(45 50 50)" />
      <rect x="42" y="10" width="16" height="80" rx="2" transform="rotate(-45 50 50)" />
    </svg>
  );
};

export default Logo;