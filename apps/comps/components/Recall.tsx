import Image from "next/image";

import { cn } from "@recallnet/ui2/lib/utils";

interface RecallProps {
  /**
   * Size of the recall token icon
   * @default "sm"
   */
  size?: "sm" | "md" | "lg";
  /**
   * Background color class for the rounded container
   * @default "bg-gray-300"
   */
  backgroundClass?: string;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  /**
   * Alt text for the image
   * @default "Recall Token"
   */
  alt?: string;
  /**
   * Width of the image
   * @default 16
   */
  width?: number;
  /**
   * Height of the image
   * @default 16
   */
  height?: number;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const defaultImageSizes = {
  sm: 16,
  md: 16,
  lg: 20,
};

/**
 * A reusable component that displays the Recall token icon in a rounded container
 */
export const Recall: React.FunctionComponent<RecallProps> = ({
  size = "sm",
  backgroundClass = "bg-gray-300",
  className,
  alt = "Recall Token",
  width,
  height,
}) => {
  const imageSize =
    width && height
      ? { width, height }
      : {
          width: defaultImageSizes[size],
          height: defaultImageSizes[size],
        };

  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full p-1",
        sizeClasses[size],
        backgroundClass,
        className,
      )}
    >
      <Image
        src="/recall-token.svg"
        alt={alt}
        width={imageSize.width}
        height={imageSize.height}
      />
    </div>
  );
};
