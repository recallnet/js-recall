import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@recallnet/ui2/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 font-semibold uppercase text-white hover:bg-[#003D7A] disabled:hover:bg-blue-600",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:hover:bg-destructive",
        outline:
          "bg-background text-secondary-foreground disabled:hover:bg-background disabled:hover:text-secondary-foreground border border-gray-400 hover:bg-blue-700 hover:text-white",
        secondary:
          "bg-secondary hover:bg-secondary/90 disabled:hover:bg-secondary font-semibold uppercase text-[#e9edf1]",
        ghost:
          "bg-white text-black hover:bg-blue-700 hover:text-white disabled:hover:bg-white disabled:hover:text-black",
        link: "text-primary underline-offset-4 hover:underline disabled:hover:no-underline",
        modal:
          "border bg-white text-black hover:bg-gray-300 disabled:hover:bg-white",
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

export interface ButtonProps {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  children: React.ReactNode;
  /**
   * When `asChild` is true, the button will behave as a *slot* – it will
   * simply merge its props and class names onto the immediate child element
   * you pass, instead of rendering its own element. This is the preferred
   * pattern when you need to style a different underlying element (e.g. a
   * `next/link` component) without introducing an extra DOM node that could
   * violate HTML semantics such as nesting an `<a>` inside another `<a>`.
   *
   * See: https://www.radix-ui.com/primitives/docs/utilities/slot
   */
  asChild?: boolean;
  as?: "button" | "a";
  href?: string;
  [key: string]: unknown;
}

function Button({
  className,
  variant,
  size,
  asChild,
  as = "button",
  href,
  children,
  ...props
}: ButtonProps) {
  // When `asChild` is provided we render a Radix `Slot` so the caller can
  // pass any element (e.g. `next/link`) and still get our styling.
  const Comp: React.ElementType = asChild ? Slot : as;

  return (
    <Comp
      // Merge variant-based styles with the incoming className
      className={cn(buttonVariants({ variant, size, className }))}
      // Only set `href` when we are *actually* rendering an <a> ourselves.
      // When `asChild` is true the consumer is responsible for providing it.
      {...(!asChild && as === "a" ? { href } : {})}
      {...props}
    >
      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
