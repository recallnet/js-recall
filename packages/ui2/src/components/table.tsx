import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
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
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom border-separate border-spacing-0 overflow-hidden rounded-xl border text-sm",
        className,
      )}
      {...props}
    />
  );
}

function TableHeader({ className, ref, ...props }: TableHeaderProps) {
  return (
    <thead
      ref={ref}
      className={cn("bg-card font-mono font-bold [&_tr]:border-0", className)}
      {...props}
    />
  );
}

function TableBody({ className, ref, ...props }: TableBodyProps) {
  return <tbody ref={ref} className={cn("", className)} {...props} />;
}

function TableFooter({ className, ref, ...props }: TableFooterProps) {
  return (
    <tfoot ref={ref} className={cn("font-medium", className)} {...props} />
  );
}

function TableRow({ className, ref, ...props }: TableRowProps) {
  return (
    <tr
      ref={ref}
      className={cn(
        "hover:bg-accent/50 data-[state=selected]:bg-muted border-t transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ref, ...props }: TableHeadProps) {
  return (
    <th
      ref={ref}
      className={cn(
        "text-primary-foreground flex h-12 items-center px-4 align-middle font-bold",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ref, ...props }: TableCellProps) {
  return <td ref={ref} className={cn("p-4", className)} {...props} />;
}

function TableCaption({ className, ref, ...props }: TableCaptionProps) {
  return (
    <caption
      ref={ref}
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export type SortState = "none" | "asc" | "desc";

export interface SortableTableHeaderProps extends TableHeadProps {
  sortState?: SortState;
  onToggleSort?: () => void;
}

function SortableTableHeader({
  className,
  sortState = "none",
  onToggleSort = () => 1,
  ...props
}: SortableTableHeaderProps) {
  const getSortIcon = () => {
    switch (sortState) {
      case "asc":
        return <ArrowUp className="text-white" size={16} />;
      case "desc":
        return <ArrowDown className="text-white" size={16} />;
      default:
        return <ArrowDownUp className="text-secondary-foreground" size={16} />;
    }
  };

  return (
    <TableHead
      onClick={onToggleSort}
      className={cn(
        "hover:bg-accent/50 cursor-pointer text-left text-sm font-bold leading-[150%] tracking-[0.03em]",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className="font-bold">{props.children}</span>
        {getSortIcon()}
      </div>
    </TableHead>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  SortableTableHeader,
};
