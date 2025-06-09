import {ArrowDownUp} from "lucide-react";
import * as React from "react";

import {cn} from "@recallnet/ui2/lib/utils";

export type TableProps = React.JSX.IntrinsicElements["table"];
export type TableHeaderProps = React.JSX.IntrinsicElements["thead"];
export type TableBodyProps = React.JSX.IntrinsicElements["tbody"];
export type TableFooterProps = React.JSX.IntrinsicElements["tfoot"];
export type TableRowProps = React.JSX.IntrinsicElements["tr"];
export type TableHeadProps = React.JSX.IntrinsicElements["th"];
export type TableCellProps = React.JSX.IntrinsicElements["td"];
export type TableCaptionProps = React.JSX.IntrinsicElements["caption"];

function Table({className, ref, ...props}: TableProps) {
  return (
    <div className="w-full overflow-x-scroll rounded-xl border">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({className, ref, ...props}: TableHeaderProps) {
  return (
    <thead ref={ref} className={cn("[&_tr]:border-0", className)} {...props} />
  );
}

function TableBody({className, ref, ...props}: TableBodyProps) {
  return <tbody ref={ref} className={cn("", className)} {...props} />;
}

function TableFooter({className, ref, ...props}: TableFooterProps) {
  return (
    <tfoot ref={ref} className={cn("font-medium", className)} {...props} />
  );
}

function TableRow({className, ref, ...props}: TableRowProps) {
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

function TableHead({className, ref, ...props}: TableHeadProps) {
  return (
    <th
      ref={ref}
      className={cn(
        "text-primary-foreground flex h-12 items-center px-4 align-middle font-medium",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({className, ref, ...props}: TableCellProps) {
  return (
    <td ref={ref} className={cn("p-4 align-middle", className)} {...props} />
  );
}

function TableCaption({className, ref, ...props}: TableCaptionProps) {
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
  const iconSize = sortState === "none" ? 20 : 22;
  const iconClass = cn(
    "transition-transform duration-200",
    sortState === "none" && "text-secondary-foreground",
    sortState !== "none" && "text-white",
    sortState === "desc" && "rotate-180",
  );

  return (
    <TableHead
      onClick={onToggleSort}
      className={cn("hover:bg-accent/50 cursor-pointer text-left", className)}
      {...props}
    >
      <div className="flex items-center gap-1">
        <span className="font-semibold">{props.children}</span>
        <ArrowDownUp className={iconClass} size={iconSize} />
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
