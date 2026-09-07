/**
 * Small Odoo-flavoured building blocks shared by every screen.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { IconChevronDown, IconInfo } from "./icons";

// ---------------------------------------------------------------- popover

interface DropdownProps {
  label: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  width?: number;
  className?: string;
  buttonClassName?: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}

export function Dropdown({
  label,
  children,
  align = "left",
  width = 260,
  className = "",
  buttonClassName = "o-btn o-btn-ghost",
  active,
  disabled,
  title,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: 480 });

  /**
   * The panel is rendered through a portal on document.body and positioned
   * with `fixed` coordinates measured from the trigger.
   *
   * It used to be an absolutely positioned sibling, which meant any ancestor
   * with a scroll container clipped it. The navbar's own menu row scrolls
   * horizontally on narrow screens, and `overflow-x: auto` forces `overflow-y`
   * to compute to `auto` as well, so every application menu was being cut off
   * at the 46px navbar. Portalling removes the whole class of bug: no ancestor
   * overflow, transform or z-index can trap the panel again.
   */
  const place = useCallback(() => {
    const trigger = holder.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const margin = 8;

    const wantRight = align === "right";
    let left = wantRight ? rect.right - width : rect.left;
    // Flip or clamp so the panel always stays on screen.
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, rect.right - width);
    }
    if (left < margin) left = margin;

    const below = window.innerHeight - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    const openUp = below < 200 && above > below;
    const maxHeight = Math.max(160, Math.min(480, openUp ? above : below));
    const top = openUp ? rect.top - gap - maxHeight : rect.bottom + gap;

    setPos({ top, left, maxHeight });
  }, [align, width]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (holder.current?.contains(target)) return;
      if (panel.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // Re-measure rather than close, so the menu tracks its trigger.
    const onReflow = () => place();

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, place]);

  return (
    <div ref={holder} className={`relative ${className}`}>
      <button
        type="button"
        className={buttonClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
        data-active={active || open ? "true" : undefined}
      >
        {label}
        <IconChevronDown size={11} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            className="o-popover fixed py-1 overflow-y-auto"
            style={{
              width,
              top: pos.top,
              left: pos.left,
              maxHeight: pos.maxHeight,
            }}
          >
            {typeof children === "function"
              ? children(() => setOpen(false))
              : children}
          </div>,
          document.body,
        )}
    </div>
  );
}

// ------------------------------------------------------------------ misc

export function MenuTitle({ children }: { children: ReactNode }) {
  return <div className="o-menu-title">{children}</div>;
}

export function MenuSeparator() {
  return <div className="o-menu-sep" />;
}

export function MenuItem({
  children,
  onClick,
  selected,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`o-menu-item ${className}`}
      data-selected={selected ? "true" : undefined}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: "ok" | "warn" | "bad" | "info" | "neutral" | "brand";
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`o-badge tone-${tone}`} title={title}>
      {children}
    </span>
  );
}

/** Odoo-style help bubble: a quiet marker with a hover explanation. */
export function Hint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex align-middle text-[var(--o-text-subtle)] cursor-help"
      title={text}
    >
      <IconInfo size={12} />
    </span>
  );
}

export function SectionTitle({
  children,
  hint,
  right,
}: {
  children: ReactNode;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] flex items-center gap-1.5">
        {children}
        {hint && <Hint text={hint} />}
      </h3>
      {right}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <p className="text-[var(--o-fs-lg)] font-medium text-[var(--o-gray-700)]">
        {title}
      </p>
      {hint && (
        <p className="mt-1 max-w-md text-[var(--o-fs-sm)] text-[var(--o-text-muted)]">
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------ smart button

export function SmartButton({
  value,
  label,
  to,
  onClick,
  title,
}: {
  value: ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  title?: string;
}) {
  const content = (
    <>
      <span className="val o-tabular">{value}</span>
      <span className="lbl">{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="o-smart-btn no-underline" title={title}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className="o-smart-btn" onClick={onClick} title={title}>
      {content}
    </button>
  );
}

// ------------------------------------------------------------------ tabs

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 border-b border-[var(--o-border)] overflow-x-auto"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          className="o-tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-[var(--o-fs-xs)] text-[var(--o-text-subtle)]">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- dialog

export function Dialog({
  title,
  children,
  footer,
  onClose,
  width = 560,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  const labelId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-start justify-center p-6 overflow-y-auto"
      style={{ background: "rgba(33,37,41,0.42)", zIndex: 1050 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="o-popover mt-[6vh] w-full"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--o-border)]">
          <h2 id={labelId} className="text-[var(--o-fs-lg)] font-medium m-0">
            {title}
          </h2>
          <button
            type="button"
            className="o-btn o-btn-ghost o-btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--o-border)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
