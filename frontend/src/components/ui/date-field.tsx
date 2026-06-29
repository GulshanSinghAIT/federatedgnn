"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

interface DateFieldProps {
  /** ISO date string 'YYYY-MM-DD' (or '' / undefined for empty). */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function parseISO(s?: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toISO(d?: Date): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function format(d?: Date): string {
  return d
    ? d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : "";
}

/**
 * Date picker: a trigger button + popover calendar (react-day-picker via
 * components/ui/calendar). Controlled with an ISO 'YYYY-MM-DD' string, so it's
 * a drop-in replacement for an `<input type="date">`.
 */
export function DateField({ value, onChange, placeholder = "Pick a date", disabled, className }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const shape = useShape();
  const selected = parseISO(value);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="tertiary"
        disabled={disabled}
        leadingIcon={CalendarIcon}
        onClick={() => setOpen(o => !o)}
        className={cn("w-full justify-start font-normal", !selected && "text-muted-foreground")}
      >
        {selected ? format(selected) : placeholder}
      </Button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 mt-2 bg-card border border-border shadow-surface-3 p-2",
            shape.container
          )}
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d?: Date) => {
              onChange(toISO(d));
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default DateField;
