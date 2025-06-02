import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@recallnet/ui2/lib/utils";

const badgeVariants = cva(
  "w-fit rounded border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        green: "border-green-500 text-green-500",
        blue: "border-blue-500 text-blue-500",
        gray: "border-gray-500 text-gray-500",
        white: "border-white text-white",
      },
    },
    defaultVariants: {
      variant: "gray",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
