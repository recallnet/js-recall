import { cn } from "@recallnet/ui2/lib/utils";

export const Hexagon: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  style,
  ...props
}) => {
  return (
    <div
      className={cn(
        "h-13 w-13 flex items-center justify-center overflow-hidden text-white",
        className,
      )}
      style={{
        clipPath:
          "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
        WebkitClipPath:
          "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
