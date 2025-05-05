import * as React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

export type TableProps = React.JSX.IntrinsicElements["table"];
export type TableHeaderProps = React.JSX.IntrinsicElements["thead"];
export type TableBodyProps = React.JSX.IntrinsicElements["tbody"];
export type TableFooterProps = React.JSX.IntrinsicElements["tfoot"];
export type TableRowProps = React.JSX.IntrinsicElements["tr"];
export type TableHeadProps = React.JSX.IntrinsicElements["th"];
export type TableCellProps = React.JSX.IntrinsicElements["td"];
export type TableCaptionProps = React.JSX.IntrinsicElements["caption"];

function Table({ className, ref, ...props }: TableProps) {
  return (
    <div className="w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}
Table.displayName = "Table";

function TableHeader({ className, ref, ...props }: TableHeaderProps) {
  return <thead ref={ref} className={cn("", className)} {...props} />;
}
TableHeader.displayName = "TableHeader";

function TableBody({ className, ref, ...props }: TableBodyProps) {
  return <tbody ref={ref} className={cn("", className)} {...props} />;
}
TableBody.displayName = "TableBody";

function TableFooter({ className, ref, ...props }: TableFooterProps) {
  return (
    <tfoot
      ref={ref}
      className={cn("border-t font-medium", className)}
      {...props}
    />
  );
}
TableFooter.displayName = "TableFooter";

function TableRow({ className, ref, ...props }: TableRowProps) {
  return (
    <tr
      ref={ref}
      className={cn(
        "hover:bg-accent/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}
TableRow.displayName = "TableRow";

function TableHead({ className, ref, ...props }: TableHeadProps) {
  return (
    <th
      ref={ref}
      className={cn(
        "text-muted-foreground h-12 px-4 align-middle font-medium",
        className,
      )}
      {...props}
    />
  );
}
TableHead.displayName = "TableHead";

function TableCell({ className, ref, ...props }: TableCellProps) {
  return (
    <td ref={ref} className={cn("p-4 align-middle", className)} {...props} />
  );
}
TableCell.displayName = "TableCell";

function TableCaption({ className, ref, ...props }: TableCaptionProps) {
  return (
    <caption
      ref={ref}
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
