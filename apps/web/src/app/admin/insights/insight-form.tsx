"use client";
import { useActionState } from "react";
import { saveInsightAction, type InsightFormState } from "./actions";

export interface InsightDefaults { id?: string; title: string; slug: string; excerpt: string; body: string; status: string; categoryId: string; tags: string; seoTitle: string; seoDescription: string; canonicalUrl: string }
const box = "mt-1 w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-sm aria-[invalid=true]:border-red-500";

export function InsightForm({ defaults, canPublish, categories, statuses, publicHref }: { defaults: InsightDefaults; canPublish: boolean; categories: { id: string; name: string }[]; statuses: string[]; publicHref?: string }) {
  const [state, action, pending] = useActionState<InsightFormState, FormData>(saveInsightAction, { status: "idle" });
  const fe = state.fieldErrors ?? {};
  const c = (n: string) => ({ id: n, name: n, "aria-invalid": fe[n] ? true : undefined }) as const;
  const f = (name: string, label: string, el: React.ReactNode, hint?: string) => (
    <div><label htmlFor={name} className="block text-sm font-medium text-navy-900">{label}</label>{el}
      {hint && !fe[name] && <p className="mt-1 text-xs text-slate-500">{hint}</p>}{fe[name] && <p role="alert" className="mt-1 text-sm text-red-700">{fe[name]}</p>}</div>
  );
  return (
    <form action={action} className="space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {f("title", "Title", <input {...c("title")} defaultValue={defaults.title} className={box} />)}
      {f("slug", "URL slug", <input {...c("slug")} defaultValue={defaults.slug} className={box} />, "Leave empty to create it from the title. Changing it changes the public address.")}
      {f("excerpt", "Summary", <textarea {...c("excerpt")} rows={3} defaultValue={defaults.excerpt} className={box} />, "Shown in lists and search results. Up to 300 characters.")}
      {f("body", "Article", <textarea {...c("body")} rows={18} defaultValue={defaults.body} className={`${box} font-mono`} />, "Formatting: ## Heading, ### Subheading, - bullet, 1. numbered, > quote, **bold**, [link text](https://address). Blank line starts a new paragraph.")}
      <div className="grid gap-4 sm:grid-cols-2">
        {f("categoryId", "Category", <select {...c("categoryId")} defaultValue={defaults.categoryId} className={box}><option value="">None</option>{categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>)}
        {f("newCategoryName", "Or create a new category", <input {...c("newCategoryName")} className={box} />, "If filled, this category is used instead.")}
      </div>
      {f("tags", "Tags", <input {...c("tags")} defaultValue={defaults.tags} className={box} />, "Comma-separated, up to 10.")}
      <fieldset className="space-y-4 rounded-md border border-mist-200 p-4"><legend className="px-1 text-sm font-medium text-navy-900">Search engine settings (optional)</legend>
        {f("seoTitle", "SEO title", <input {...c("seoTitle")} defaultValue={defaults.seoTitle} className={box} />, "Up to 70 characters. Defaults to the title.")}
        {f("seoDescription", "SEO description", <textarea {...c("seoDescription")} rows={2} defaultValue={defaults.seoDescription} className={box} />, "Up to 170 characters. Defaults to the summary.")}
        {f("canonicalUrl", "Canonical URL", <input {...c("canonicalUrl")} defaultValue={defaults.canonicalUrl} className={box} />, "Only if this article was first published elsewhere.")}
      </fieldset>
      {f("status", "Status", <select {...c("status")} defaultValue={defaults.status} className={box}>{statuses.map((s) => <option key={s} value={s} disabled={s === "PUBLISHED" && !canPublish && defaults.status !== "PUBLISHED"}>{s.toLowerCase()}</option>)}</select>, canPublish ? "Only published articles appear on the website." : "You can save drafts. Publishing needs the insight:publish permission.")}
      {state.message && <p role="status" className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p>}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Save article"}</button>
        {publicHref && defaults.status === "PUBLISHED" && <a href={publicHref} target="_blank" rel="noopener noreferrer" className="text-sm text-electric-600 underline">View on site</a>}
      </div>
    </form>
  );
}
