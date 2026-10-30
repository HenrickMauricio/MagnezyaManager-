import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-fg", className)} {...props} />;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-md border border-transparent bg-surface-2 px-3.5 text-[15px] text-fg placeholder:text-fg-subtle transition-colors",
        "hover:bg-surface-3 focus:border-fg focus:bg-surface focus:outline-none",
        invalid && "border-danger focus:border-danger",
        className,
      )}
      {...props}
    />
  );
});

export function FieldError({ messages, id }: { messages?: string[]; id?: string }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="text-[13px] text-danger">
      {messages[0]}
    </p>
  );
}
