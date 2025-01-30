export default function Metric({
  title,
  value,
  valueTooltip,
  subtitle,
}: {
  title?: string;
  value?: string;
  valueTooltip?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      {title && <span className="text-muted-foreground text-xs">{title}</span>}
      {value && (
        <span title={valueTooltip} className="text-lg font-medium">
          {value}
        </span>
      )}
      {subtitle && (
        <span className="text-muted-foreground text-sm">{subtitle}</span>
      )}
    </div>
  );
}
