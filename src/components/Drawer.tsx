import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './ui';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Drawer({ open, onClose, labelledBy, header, children }: { open: boolean; onClose: () => void; labelledBy: string; header: ReactNode; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const restore = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement;
    closeBtn.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      const el = restore.current as HTMLElement | null;
      el?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panel}>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>{header}</div>
          <button ref={closeBtn} type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
