"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Filter = { name: string; label: string; options: { value: string; label: string }[]; defaultValue: string };

/**
 * Pesquisa + filtros de uma lista. O estado vive no URL (partilhável, funciona
 * com "voltar"); a pesquisa é aplicada 300 ms depois de parar de escrever.
 * Sem `placeholder`, mostra só os filtros (ex.: relatórios).
 */
export function ListFilters({ placeholder, filters = [] }: { placeholder?: string; filters?: Filter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply(updates: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      const filter = filters.find((f) => f.name === key);
      if (value === "" || value === filter?.defaultValue) next.delete(key);
      else next.set(key, value);
    }
    next.delete("pagina"); // novo filtro → volta à primeira página
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row", pending && "opacity-80")}>
      {placeholder !== undefined && (
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => apply({ q: value.trim() }), 300);
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="pl-10"
          />
        </div>
      )}
      {filters.map((f) => (
        <Select
          key={f.name}
          aria-label={f.label}
          defaultValue={params.get(f.name) ?? f.defaultValue}
          onChange={(e) => apply({ [f.name]: e.target.value })}
          className="sm:w-48"
        >
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}
    </div>
  );
}
