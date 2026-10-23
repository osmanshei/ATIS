"use client";

export function PrintButton() {
  return (
    <button className="button no-print" type="button" onClick={() => window.print()}>
      Print admission letter
    </button>
  );
}
