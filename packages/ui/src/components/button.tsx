import { cn } from "../lib/utils.js";
import { Button as ShadcnButton } from "./shadcn/button.js";

function Button({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ShadcnButton>) {
  return (
    <ShadcnButton
      className={cn("rounded-none font-mono uppercase", className)}
      {...props}
    >
      {children}
    </ShadcnButton>
  );
}

export { Button };
