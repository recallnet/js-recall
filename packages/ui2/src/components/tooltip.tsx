import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  tooltipClassName?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  className = '',
  tooltipClassName = ''
}) => {
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  return (
    <div className={`group relative inline-block ${className}`}>
      {children}
      <div
        className={`
          absolute
          ${getPositionClasses()}
          min-w-max
          p-2
          bg-gray-800
          text-white
          text-sm
          rounded-md
          shadow-lg
          opacity-0
          group-hover:opacity-100
          invisible
          group-hover:visible
          transition-opacity
          duration-200
          pointer-events-none /* Allows clicks to pass through when hidden */
          z-50 /* Ensure it appears above other content */
          ${tooltipClassName}
        `}
      >
        {content}
      </div>
    </div>
  );
};

export default Tooltip;
