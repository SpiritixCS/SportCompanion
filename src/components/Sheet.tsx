"use client";

import { useEffect } from "react";
import { IconClose } from "./icons/IconClose";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={title}>
      <div
        data-testid="sheet-backdrop"
        className="sheet-fade absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div className="sheet-rise relative w-full max-h-[90dvh] overflow-y-auto bg-paper rounded-t-[28px] px-[18px] pt-2.5 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <div aria-hidden="true" className="w-10 h-1 rounded-pill bg-hairline mx-auto mb-3.5" />
        <div className="flex items-start justify-between gap-4 mb-4">
          <span className="font-display font-extrabold text-32 uppercase leading-[0.9]">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-10 h-10 rounded-pill border border-hairline bg-paper flex items-center justify-center flex-none"
          >
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
