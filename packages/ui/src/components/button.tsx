import { Button as ShadcnButton } from "@recallnet/ui/components/shadcn/button";
import { cn } from "@recallnet/ui/lib/utils";

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
