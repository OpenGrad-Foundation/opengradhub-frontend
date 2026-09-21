"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./catalogue.module.css";

export function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
  ariaLabel = "Course pages",
}: {
  ariaLabel?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach(i => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const pages = getVisiblePages();

  return (
    <nav aria-label={ariaLabel} className={styles.pagination}>
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={styles.pageButton}
      >
        <ChevronLeft size={14} />
      </button>

      {pages.map((p, index) => {
        if (p === '...') {
          return (
            <span key={`dots-${index}`} className="px-1 text-xs text-[rgba(3,72,82,0.45)]">
              &hellip;
            </span>
          );
        }

        const pageNum = p as number;
        return (
          <button
            key={pageNum}
            aria-label={`Page ${pageNum}`}
            aria-current={pageNum === currentPage ? "page" : undefined}
            type="button"
            onClick={() => onPageChange(pageNum)}
            className={styles.pageButton}
          >
            {pageNum}
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Next page"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={styles.pageButton}
      >
        <ChevronRight size={14} />
      </button>
    </nav>
  );
}
