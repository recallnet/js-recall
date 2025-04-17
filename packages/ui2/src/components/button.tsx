import { type VariantProps, cva } from "class-variance-authority";

// This is just an example of a component that uses the cva utility and Tailwind CSS classes.

const buttonVariants = cva("p-4", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Button({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button className={buttonVariants({ variant, className })} {...props}>
      {children}
    </button>
  );
}

export { Button };
