import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@recallnet/ui2/lib/utils";

// This is just an example of a component that uses the cva utility and Tailwind CSS classes.

const buttonVariants = cva(
  "inline-flex items-center justify-center text-sm font-medium transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 font-semibold uppercase text-white hover:bg-blue-700",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "bg-background text-secondary-foreground border hover:bg-blue-700 hover:text-white",
        secondary:
          "bg-secondary hover:bg-secondary/90 font-semibold uppercase text-[#e9edf1]",
        ghost: "bg-white text-black hover:bg-blue-700 hover:text-white",
        link: "text-primary underline-offset-4 hover:underline",
        modal: "border border-gray-200 bg-white text-black hover:bg-gray-100",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 p-7 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </button>
  );
}

export { Button, buttonVariants };
