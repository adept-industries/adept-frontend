import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export interface NavigationDropdownOption {
  id: string;
  label: string;
}

export interface NavigationDropdownAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface NavigationDropdownProps {
  id: string;
  ariaLabel: string;
  options: NavigationDropdownOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  busyLabel?: string;
  align?: "left" | "right";
  action?: NavigationDropdownAction;
}

export function NavigationDropdown({
  id,
  ariaLabel,
  options,
  selectedId,
  onSelect,
  disabled = false,
  busyLabel,
  align = "left",
  action,
}: NavigationDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.id === selectedId);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const handleSelect = (optionId: string) => {
    setOpen(false);
    if (optionId !== selectedId) onSelect(optionId);
  };

  return (
    <div
      ref={containerRef}
      className="navigation-dropdown"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="navigation-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="navigation-dropdown-value">
          {disabled && busyLabel ? busyLabel : (selected?.label ?? "Select")}
        </span>
        <span className="navigation-dropdown-caret" aria-hidden>▼</span>
      </button>

      {open && (
        <div
          id={`${id}-menu`}
          role="listbox"
          aria-label={ariaLabel}
          className={`navigation-dropdown-menu navigation-dropdown-menu--${align}`}
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === selectedId}
              className="navigation-dropdown-option"
              onClick={() => handleSelect(option.id)}
            >
              <span>{option.label}</span>
              {option.id === selectedId && <span aria-hidden>✓</span>}
            </button>
          ))}

          {action && (
            <>
              <div
                style={{
                  height: "1px",
                  background: "var(--border-color)",
                  margin: "0.25rem 0",
                  opacity: 0.7,
                }}
              />
              <button
                type="button"
                className="navigation-dropdown-option"
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--primary-light, #818cf8)",
                  fontWeight: 500,
                }}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
