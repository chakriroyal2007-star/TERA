import { ReactNode, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import { api, queryClient, label } from "./api";
export function Empty({
  title = "Nothing here yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{children || "Records will appear here when they are created."}</p>
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Loading records…
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return <span className={"badge " + value}>{label(value)}</span>;
}
export function PageHead({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </header>
  );
}
export function Panel({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Action({
  path,
  body = {},
  method = "POST",
  children,
  onSuccess,
  secondary = false,
}: {
  path: string;
  body?: unknown;
  method?: string;
  children: ReactNode;
  onSuccess?: () => void;
  secondary?: boolean;
}) {
  const m = useMutation({
    mutationFn: () => api(path, method, body),
    onSuccess: () => {
      queryClient.invalidateQueries();
      onSuccess?.();
    },
  });
  return (
    <div className="action-wrap">
      <button
        className={secondary ? "secondary" : "primary"}
        disabled={m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? "Saving…" : children}
      </button>
      <ErrorBox error={m.error} />
      {m.isSuccess && (
        <span className="saved">
          <CheckCircle2 size={14} /> Saved
        </span>
      )}
    </div>
  );
}
export interface FieldDef {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  value?: string | number;
  min?: number;
  max?: number;
}
export function DataForm({
  fields,
  path,
  method = "POST",
  submit = "Save",
  transform,
  onSuccess,
}: {
  fields: FieldDef[];
  path: string;
  method?: string;
  submit?: string;
  transform?: (data: any) => any;
  onSuccess?: (data: any) => void;
}) {
  const m = useMutation({
    mutationFn: (data: any) =>
      api(path, method, transform ? transform(data) : data),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      onSuccess?.(data);
    },
  });
  return (
    <form
      className="data-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const values: Record<string, unknown> = {};
        fields.forEach((f) => {
          const v = fd.get(f.name);
          values[f.name] =
            f.type === "number" ? (v === "" ? null : Number(v)) : v;
        });
        m.mutate(values);
      }}
    >
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.options ? (
            <select
              name={f.name}
              defaultValue={f.value ?? ""}
              required={f.required !== false}
            >
              <option value="">Select…</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              name={f.name}
              defaultValue={f.value}
              required={f.required !== false}
              maxLength={3000}
            />
          ) : (
            <input
              name={f.name}
              type={f.type || "text"}
              defaultValue={f.value}
              required={f.required !== false}
              min={f.min}
              max={f.max}
              step={f.type === "number" ? "any" : undefined}
              maxLength={500}
            />
          )}
        </label>
      ))}
      <ErrorBox error={m.error} />
      {m.isSuccess && (
        <div className="notice success">
          <CheckCircle2 size={18} />
          Saved successfully
        </div>
      )}
      <button className="primary" disabled={m.isPending}>
        {m.isPending ? "Saving…" : submit}
        <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
