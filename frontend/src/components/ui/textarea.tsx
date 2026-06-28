"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

/**
 * Design-system multiline text input. The ui set ships no textarea primitive,
 * so this mirrors the Select/Input trigger styling (border-border, bg, focus
 * ring, shape-aware radius) for a consistent look.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => {
    const shape = useShape();
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={!!error || undefined}
        className={cn(
          "w-full px-3 py-2 text-[13px] bg-transparent text-foreground",
          "border border-border outline-none resize-y",
          "transition-colors duration-80 placeholder:text-muted-foreground",
          "hover:bg-hover focus-visible:ring-1 focus-visible:ring-[#6B97FF]",
          "disabled:opacity-50 disabled:pointer-events-none",
          shape.input,
          error && "border-destructive/50",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
export type { TextareaProps };
