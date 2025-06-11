import React from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  tooltipClassName?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
  className = "",
  tooltipClassName = "",
}) => {
  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "bottom-full left-1/2 -translate-x-1/2 mb-2";
      case "bottom":
        return "top-full left-1/2 -translate-x-1/2 mt-2";
      case "left":
        return "right-full top-1/2 -translate-y-1/2 mr-2";
      case "right":
        return "left-full top-1/2 -translate-y-1/2 ml-2";
      default:
        return "bottom-full left-1/2 -translate-x-1/2 mb-2";
    }
  };

  return (
    <div className={`group relative inline-block ${className}`}>
      <span className="inline-block">{children}</span>
      <div
        className={`absolute ${getPositionClasses()} pointer-events-none invisible z-50 min-w-max rounded-xl bg-gray-900 p-2 text-sm text-white opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100 ${tooltipClassName} `}
      >
        {content}
      </div>
    </div>
  );
};

export default Tooltip;
