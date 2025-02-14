import { ReactNode } from "react";

export default function Metric({
  title,
  value,
  valueTooltip,
  subtitle,
}: {
  title?: string;
  value?: ReactNode;
  valueTooltip?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      {title && <span className="text-muted-foreground text-xs">{title}</span>}
      {value && (
        <span title={valueTooltip} className="text-2xl font-medium">
          {value}
        </span>
      )}
      {subtitle && (
        <span className="text-muted-foreground text-sm">{subtitle}</span>
      )}
    </div>
  );
}
