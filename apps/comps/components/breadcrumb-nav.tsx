import React from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@recallnet/ui2/components/breadcrumb";
import { cn } from "@recallnet/ui2/lib/utils";

import { BackButton } from "@/components/back-button";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbNav({ items, className }: BreadcrumbNavProps) {
  return (
    <div
      className={cn("mb-6 flex items-center gap-2 border-b pb-4", className)}
    >
      <BackButton />
      <Breadcrumb>
        <BreadcrumbList className="font-mono">
          {items.map((item, index) => (
            <React.Fragment key={item.label}>
              <BreadcrumbItem className="uppercase">
                {item.href ? (
                  <BreadcrumbLink className="uppercase" href={item.href}>
                    {item.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {index < items.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
