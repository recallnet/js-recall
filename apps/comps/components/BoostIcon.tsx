interface BoostIconProps {
  className?: string;
  fill?: boolean;
  size?: number;
  color?: string;
  alt?: string;
}

/**
 * BoostIcon component that renders the Recall boost lightning bolt icon
 * @param className - Additional CSS classes to apply
 * @param fill - Whether to fill the icon (true) or use outline/stroke (false)
 * @param size - Width and height of the icon in pixels (default: 16)
 * @param color - Color of the icon (default: #FAC021 yellow)
 */
export const BoostIcon = ({
  className,
  size = 16,
  color = "#FAC021",
  alt = "Boost",
}: BoostIconProps) => {
  return (
    <svg
      aria-label={alt}
      width={size}
      height={size}
      viewBox="0 0 1442 1734"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g opacity="0.9">
        <path
          d="M1329.11 661.709L1441.11 776.603L1153.8 1071.35L953.205 1071.35L953.035 1071.52L111.996 1071.52L0 956.625L287.314 661.878H487.902L488.074 661.702L1329.11 661.709Z"
          fill={color}
        />
        <path
          d="M931.177 0L1089.56 0.00164381V416.837L901.182 610.087L336.468 610.088L931.177 0Z"
          fill={color}
        />
        <path
          d="M507.735 1733.23L349.35 1733.22V1316.39L537.73 1123.14H1102.45L507.735 1733.23Z"
          fill={color}
        />
      </g>
    </svg>
  );
};
