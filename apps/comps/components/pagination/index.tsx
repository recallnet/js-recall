import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface PaginationProps {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  currentPage,
  itemsPerPage,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const pages: (number | "...")[] = [];

  const canGoLeft = currentPage > 1;
  const canGoRight = currentPage < totalPages;

  if (currentPage <= 3) {
    for (let i = 1; i <= Math.min(3, totalPages); i++) pages.push(i);
    if (totalPages > 4) {
      pages.push("...");
      pages.push(totalPages);
    } else if (totalPages > 3) {
      pages.push(totalPages);
    }
  } else if (currentPage >= totalPages - 2) {
    pages.push(1);
    if (totalPages > 4) pages.push("...");
    for (let i = totalPages - 2; i <= totalPages; i++) {
      if (i > 1) pages.push(i);
    }
  } else {
    pages.push(1);
    pages.push("...");
    pages.push(currentPage);
    pages.push("...");
    pages.push(totalPages);
  }

  const handlePrev = () => {
    if (canGoLeft) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (canGoRight) onPageChange(currentPage + 1);
  };

  return (
    <div className="mt-6 flex items-center justify-center gap-1">
      <ChevronLeft
        onClick={handlePrev}
        className={cn(
          "mr-3 text-gray-500",
          canGoLeft ? "cursor-pointer" : "text-gray-700",
        )}
        size={30}
      />

      {pages.map((page, idx) =>
        page === "..." ? (
          <PagBox key={`dots-${idx}`} disabled>
            ...
          </PagBox>
        ) : (
          <PagBox
            key={page}
            onClick={() => onPageChange(page)}
            selected={currentPage === page}
          >
            {page}
          </PagBox>
        ),
      )}

      <ChevronRight
        onClick={handleNext}
        className={cn(
          "ml-3 text-gray-500",
          canGoRight ? "cursor-pointer" : "text-gray-700",
        )}
        size={30}
      />
    </div>
  );
};

interface PagBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  disabled?: boolean;
}

const PagBox: React.FC<PagBoxProps> = ({
  children,
  onClick,
  selected,
  disabled,
}) => {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={cn(
        "cursor-pointer rounded-xl border px-5 py-3 text-sm font-medium",
        selected && "bg-white text-black",
        !selected &&
          !disabled &&
          "hover:bg-card bg-transparent text-gray-400 hover:text-white",
        disabled && "cursor-default text-gray-600",
      )}
    >
      {children}
    </div>
  );
};
