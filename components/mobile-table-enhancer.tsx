"use client";

import { useEffect } from "react";

export function MobileTableEnhancer() {
  useEffect(() => {
    const addMobileLabels = () => {
      document.querySelectorAll<HTMLTableElement>("table").forEach((table: HTMLTableElement) => {
        const headerRows = table.querySelectorAll<HTMLTableRowElement>("thead tr");
        const headerRow = headerRows.item(headerRows.length - 1);
        if (!headerRow) return;

        const headerCells = headerRow.querySelectorAll<HTMLTableCellElement>("th, td");
        const headers: string[] = Array.from(
          headerCells,
          (cell: HTMLTableCellElement) => cell.textContent?.trim() || ""
        );
        if (!headers.length) return;

        let hasBodyRows = false;
        const bodyRows = table.querySelectorAll<HTMLTableRowElement>("tbody tr");
        bodyRows.forEach((row: HTMLTableRowElement) => {
          const cells = row.querySelectorAll<HTMLTableCellElement>("td");
          if (!cells.length) return;
          hasBodyRows = true;

          cells.forEach((cell: HTMLTableCellElement, index: number) => {
            if (cell.colSpan > 1 || cell.hasAttribute("data-label")) return;
            const label = headers[index] || `Column ${index + 1}`;
            if (label) cell.setAttribute("data-label", label);
          });
        });

        if (hasBodyRows) {
          table.classList.add("mobile-card-table");
          const wrapper = table.closest(".table-wrap, .timetable-table-wrap");
          wrapper?.classList.add("mobile-card-wrap");
        }
      });
    };

    addMobileLabels();
    const observer = new MutationObserver(addMobileLabels);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
