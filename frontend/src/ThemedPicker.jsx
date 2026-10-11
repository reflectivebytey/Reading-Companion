import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackLayer } from "./backStack.js";
import "./ThemedPicker.css";

export default function ThemedPicker({ id, label, ariaLabel, value, options, onChange, className = "", placeholder = "Choose an option" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef(null);
  const sheetRef = useRef(null);
  const searchable = options.length > 8;
  const selected = options.find((option) => option.value === value);
  const filtered = searchable
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : options;

  useBackLayer(open, () => closePicker());

  useEffect(() => {
    if (!open) return undefined;
    const target = searchable ? sheetRef.current?.querySelector("input") : sheetRef.current?.querySelector("[data-selected='true']") || sheetRef.current?.querySelector(".themed-picker-option");
    target?.focus();
    return undefined;
  }, [open, searchable]);

  function closePicker(restoreFocus = true) {
    setQuery("");
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const rows = [...sheetRef.current.querySelectorAll(".themed-picker-option")];
      if (!rows.length) return;
      event.preventDefault();
      const current = rows.indexOf(document.activeElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      rows[(current + direction + rows.length) % rows.length].focus();
      return;
    }
    if (event.key === "Tab") {
      const items = [...sheetRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className={`themed-picker-trigger ${className}`}
        aria-label={ariaLabel || label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="themed-picker-backdrop" onClick={() => closePicker(false)}>
          <section
            ref={sheetRef}
            className="themed-picker-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <span className="themed-picker-handle" aria-hidden="true" />
            <header className="themed-picker-heading">
              <h2>{label}</h2>
              <button type="button" aria-label="Close options" onClick={() => closePicker()}><X size={18} /></button>
            </header>
            {searchable && (
              <label className="themed-picker-search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLocaleLowerCase()}`} aria-label={`Search ${label.toLocaleLowerCase()}`} />
              </label>
            )}
            <div className="themed-picker-options" role="listbox" aria-label={label}>
              {filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  data-selected={option.value === value}
                  className="themed-picker-option"
                  onClick={() => { onChange(option.value); closePicker(); }}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Check size={18} aria-hidden="true" />}
                </button>
              ))}
              {filtered.length === 0 && <p className="themed-picker-empty">No matches</p>}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}