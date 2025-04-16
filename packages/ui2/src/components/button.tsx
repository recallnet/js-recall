import { type VariantProps, cva } from "class-variance-authority";
import { ComponentProps } from "react";

const buttonVariants = cva("p-4", {
  variants: {
    variant: {
      default: "bg-blue-500",
      destruvtive: "bg-red-500",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Button({
  className,
  variant,
  children,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button className={buttonVariants({ variant, className })} {...props}>
      {children}
    </button>
  );
}
