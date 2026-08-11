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
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        data-testid="sheet-backdrop"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div className="relative w-full bg-paper rounded-t-card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-archivo text-18 font-semibold">{title}</span>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
