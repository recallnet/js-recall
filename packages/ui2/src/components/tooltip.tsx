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
  tooltipClassName = '',
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
    <div className={`relative inline-block group ${className}`}>
      <span className="inline-block">{children}</span>
      <div
        className={`
          absolute
          ${getPositionClasses()}
          min-w-max
          p-2
          rounded-xl
          bg-gray-900
          text-white
          text-sm
          shadow-lg
          opacity-0
          invisible
          group-hover:opacity-100
          group-hover:visible
          transition-all
          duration-200
          pointer-events-none
          z-50
          ${tooltipClassName}
        `}
      >
        {content}
      </div>
    </div>
  );
};

export default Tooltip;

