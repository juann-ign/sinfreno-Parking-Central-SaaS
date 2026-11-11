import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export default function Dialog({
  open,
  title,
  onClose,
  busy = false,
  children,
  wide = false,
}) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const element = ref.current;
    element.showModal();
    element.querySelector("[data-autofocus]")?.focus();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus?.();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`sf-dialog ${wide ? "sf-dialog-wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="sf-dialog-inner">
        <header className="sf-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="sf-icon-button"
            aria-label="Cerrar diálogo"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {open && children}
      </div>
    </dialog>
  );
}
