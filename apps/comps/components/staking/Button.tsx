import React from "react";

import { Button as BaseButton } from "@recallnet/ui2/components/button";
import type { ButtonProps as BaseButtonProps } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

export interface ButtonProps extends Omit<BaseButtonProps, "variant"> {
  variant?: "primary" | "secondary";
}

export function Button(props: ButtonProps): React.JSX.Element {
  const { className, variant = "primary", children, ...restProps } = props;

  const variantClasses = {
    primary: cn(
      "bg-gray-6 text-black",
      "hover:bg-gray-5",
      "disabled:bg-gray-4 disabled:hover:bg-gray-4 disabled:text-gray-100",
      "focus-visible:bg-gray-6 focus-visible:border-2 focus-visible:border-[#33A5FF]",
      "active:bg-gray-6 active:border-2 active:border-[#33A5FF]",
    ),
    secondary: cn(
      "border-gray-4 border bg-transparent text-gray-100",
      "hover:bg-gray-4/10",
      "disabled:text-gray-4 disabled:hover:bg-transparent",
      "focus-visible:border-2 focus-visible:border-[#33A5FF]",
      "active:border-2 active:border-[#33A5FF]",
    ),
  };

  return (
    <BaseButton
      className={cn(
        "rounded-lg px-5 py-3",
        variantClasses[variant],
        className as string | undefined,
      )}
      {...restProps}
    >
      {children as React.ReactNode}
    </BaseButton>
  );
}
