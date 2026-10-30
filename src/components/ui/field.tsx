import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-fg", className)} {...props} />;
}

const controlBase = cn(
  "w-full rounded-md border border-transparent bg-surface-2 px-3.5 text-[15px] text-fg placeholder:text-fg-subtle transition-colors",
  "hover:bg-surface-3 focus:border-fg focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
);
const invalidClass = "border-danger focus:border-danger";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "h-11", invalid && invalidClass, className)}
      {...props}
    />
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, ...props },
  ref,
) {
  return (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(controlBase, "h-11 cursor-pointer appearance-none pr-10", invalid && invalidClass)}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        strokeWidth={2}
        aria-hidden
      />
    </div>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "min-h-24 py-2.5 leading-relaxed", invalid && invalidClass, className)}
      {...props}
    />
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-[var(--fg)]" {...props} />
      <span>
        <span className="block text-[14px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-fg-muted">{description}</span>}
      </span>
    </label>
  );
}

export function FieldError({ messages, id }: { messages?: string[]; id?: string }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="text-[13px] text-danger">
      {messages[0]}
    </p>
  );
}

/**
 * Campo completo: etiqueta + controlo + ajuda + erro.
 * O controlo recebe `id`, `name` e `aria-describedby` do chamador.
 */
export function Field({
  label,
  htmlFor,
  hint,
  errors,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  errors?: string[];
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-fg-subtle">*</span>}
      </Label>
      {children}
      {hint && !errors?.length && <p className="text-[12px] text-fg-subtle">{hint}</p>}
      <FieldError id={`${htmlFor}-error`} messages={errors} />
    </div>
  );
}
