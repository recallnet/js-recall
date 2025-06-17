import * as React from "react";

/**
 * Props that we expect all icons to accept
 * @interface IconProps
 */
interface IconProps {
  className?: string;
}

/**
 * Props for the IconButton component
 * @interface IconButtonProps
 */
interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * The icon component to be rendered inside the button
   * @type {React.ComponentType<IconProps>}
   */
  Icon: React.ComponentType<IconProps>;

  /**
   * Optional class name for additional styling
   * @type {string}
   * @optional
   */
  className?: string;

  /**
   * Optional class name specifically for the icon
   * @type {string}
   * @optional
   */
  iconClassName?: string;

  /**
   * Optional ref for the button element
   * @type {React.RefObject<HTMLButtonElement>}
   * @optional
   */
  ref?: React.RefObject<HTMLButtonElement>;
}

/**
 * IconButton component - A reusable button component that displays an icon
 * with hover effects and proper accessibility attributes.
 *
 * @component
 * @example
 * ```tsx
 * import { Share1Icon } from '@radix-ui/react-icons';
 *
 * <IconButton
 *   Icon={Share1Icon}
 *   aria-label="Share"
 *   onClick={() => console.log('Shared!')}
 * />
 * ```
 */
export const IconButton = ({
  Icon,
  className = "",
  iconClassName = "",
  ref,
  ...props
}: IconButtonProps): React.ReactElement => {
  return (
    <button
      ref={ref}
      className={`rounded-full p-2 hover:bg-slate-700 disabled:opacity-50 ${className}`}
      type="button"
      {...props}
    >
      <Icon className={`h-5 w-5 ${iconClassName}`} />
    </button>
  );
};

export default IconButton;
