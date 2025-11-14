import React from "react";

import { Button as BaseButton } from "@recallnet/ui2/components/button";
import type { ButtonProps as BaseButtonProps } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

export interface ButtonProps extends Omit<BaseButtonProps, "variant"> {
  variant?: never;
}

export function Button(props: ButtonProps): React.JSX.Element {
  const { className, children, ...restProps } = props;
  return (
    <BaseButton
      className={cn(
        "bg-gray-6 text-black",
        "hover:bg-gray-5",
        "disabled:bg-gray-4 disabled:text-gray-5",
        "focus-visible:bg-gray-6 focus-visible:border-2 focus-visible:border-[#33A5FF]",
        "active:bg-gray-6 active:border-2 active:border-[#33A5FF]",
        className as string | undefined,
      )}
      {...restProps}
    >
      {children as React.ReactNode}
    </BaseButton>
  );
}
