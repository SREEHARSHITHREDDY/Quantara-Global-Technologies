import * as React from "react";
import { Container } from "@/components/ui/layout";

export const inputClass = "mt-1.5 block w-full rounded-lg border border-mist-300 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink shadow-sm placeholder:text-slate-400 focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/30";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="bg-mist-50 py-16 sm:py-24">
      <Container className="max-w-md">
        <div className="rounded-[var(--radius-card)] border border-mist-200 bg-white p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-semibold text-navy-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
      </Container>
    </section>
  );
}

export function TextField({ id, label, hint, ...p }: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-navy-900">{label}</label>
      <input id={id} name={id} className={inputClass} {...p} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export const FormError = ({ message }: { message?: string | null }) => message ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null;
export const FormNotice = ({ children }: { children: React.ReactNode }) => <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{children}</p>;

export const MIN_PASSWORD = 12;
/** Client-side convenience only; the server enforces the same minimum. */
export function passwordProblem(pw: string, confirm?: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for your password.`;
  if (confirm !== undefined && pw !== confirm) return "The two passwords do not match.";
  return null;
}
