import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'image' | 'full';
}

const Logo: React.FC<LogoProps> = ({ className = "w-full h-full", variant = 'image' }) => {
  if (variant === 'full') {
    return <img src="/assets/logos/logo-full.png" alt="Review Kit" className={className} />;
  }
  
  return <img src="/assets/logos/logo-icon.png" alt="Review Kit" className={className} />;
};

export default Logo;