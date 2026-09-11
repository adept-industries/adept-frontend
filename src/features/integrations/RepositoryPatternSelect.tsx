import { useEffect, useRef, useState } from "react";
import type { RepositorySettingsOptions } from "./api.js";
import { literalRepositoryPattern } from "./repositoryPatterns.js";
import "./RepositoryPatternSelect.css";

interface Props {
  id: string;
  label: string;
  help: string;
  placeholder: string;
  value: string[];
  onChange: (patterns: string[]) => void;
  options?: RepositorySettingsOptions;
  loading: boolean;
  disabled?: boolean;
}

export function RepositoryPatternSelect({ id, label, help, placeholder, value, onChange, options, loading, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const choices = (options?.values ?? []).map((name) => ({ name, pattern: literalRepositoryPattern(name) }));
  const query = search.trim();
  const filtered = choices.filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()));
  const displayName = (pattern: string) => choices.find((choice) => choice.pattern === pattern)?.name ?? pattern;

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function toggle(pattern: string) {
    setError(null);
    if (value.includes(pattern)) {
      onChange(value.filter((item) => item !== pattern));
    } else if (value.length >= 32) {
      setError("Choose up to 32 names or patterns.");
    } else if (pattern.length > 128) {
      setError("A pattern must be 128 characters or fewer. Try a shorter custom pattern.");
    } else {
      onChange([...value, pattern]);
    }
  }

  function addCustom() {
    if (!query || disabled) return;
    if (value.includes(query)) {
      setError("That pattern is already selected.");
      return;
    }
    toggle(query);
    if (query.length <= 128 && value.length < 32) setSearch("");
  }

  return (
    <div className="repository-pattern-select" ref={root} role="group" aria-labelledby={`${id}-label`}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}>
      <label id={`${id}-label`} htmlFor={id}>{label}</label>
      <button type="button" id={id} ref={trigger} className="repository-pattern-trigger"
        aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`} aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined} disabled={disabled}
        onClick={() => setOpen(!open)}>
        <span>{value.length ? `${value.length} selected` : "Choose names or add a pattern"}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {value.length > 0 && (
        <ul className="repository-pattern-chips" aria-label="Selected names and patterns">
          {value.map((pattern) => (
            <li key={pattern}>
              <span title={pattern}>{displayName(pattern)}</span>
              <button type="button" disabled={disabled} aria-label={`Remove ${displayName(pattern)}`}
                onClick={() => toggle(pattern)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-help`} className="repository-pattern-help">{help}</p>
      {open && (
        <div id={`${id}-panel`} className="repository-pattern-panel">
          <input ref={input} aria-label={`Search ${label}`} value={search} disabled={disabled}
            placeholder={placeholder} onChange={(event) => { setSearch(event.target.value); setError(null); }}
            onKeyDown={(event) => {
              // Enter must not accidentally submit the repository settings form.
              if (event.key === "Enter") { event.preventDefault(); addCustom(); }
            }} />
          {loading && <p role="status" className="repository-pattern-help">Loading GitHub options…</p>}
          {!loading && options?.warning && <p role="status" className="repository-pattern-help">{options.warning}</p>}
          {!loading && !options && <p role="status" className="repository-pattern-help">GitHub options unavailable. Add a pattern manually.</p>}
          <div className="repository-pattern-options">
            {filtered.map(({ name, pattern }) => (
              <label key={name} className="repository-pattern-option">
                <input type="checkbox" checked={value.includes(pattern)} disabled={disabled}
                  onChange={() => toggle(pattern)} />
                <span>{name}</span>
              </label>
            ))}
          </div>
          {!loading && filtered.length === 0 && (
            <p className="repository-pattern-help">{query ? "No matching GitHub names." : "No GitHub names found."} Add a custom pattern below.</p>
          )}
          <button type="button" className="repository-pattern-add" disabled={disabled || !query}
            onClick={addCustom}>{query ? `Add “${query}” as a custom pattern` : "Type a custom pattern to add"}</button>
          {error && <p role="alert" className="repository-pattern-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
