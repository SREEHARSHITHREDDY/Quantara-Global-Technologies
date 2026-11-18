import type { Report } from "@quantara/council";
import { Card } from "@/components/ui/layout";

/** The 20-section report. Not-assessed sections are shown, so a gap is never mistaken for a clean bill of health. */
export function ReportSections({ report, canExport, executionId }: { report: Report; canExport: boolean; executionId: string }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-navy-900">Full executive report</h3>
        {canExport && (
          <div className="flex gap-3 text-sm">
            <a className="font-medium text-electric-600 underline" href={`/api/council/executions/${executionId}/export?format=md`}>Download Markdown</a>
            <a className="font-medium text-electric-600 underline" href={`/api/council/executions/${executionId}/export?format=html`}>Download printable HTML</a>
          </div>
        )}
      </div>
      <ol className="mt-4 space-y-2">
        {report.sections.map((s) => (
          <li key={s.n}>
            <details className="rounded-lg border border-mist-200 px-4 py-2" {...(s.n <= 1 ? { open: true } : {})}>
              <summary className="cursor-pointer text-sm font-medium text-navy-900">{s.n}. {s.title}{!s.covered && <span className="ml-2 font-normal text-slate-500">(not assessed)</span>}</summary>
              <div className="mt-2 space-y-2 pb-2 text-sm text-slate-700">
                {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                {s.bullets.length > 0 && <ul className="list-disc space-y-1 pl-5">{s.bullets.map((b, i) => <li key={i}>{b.trimStart()}</li>)}</ul>}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </Card>
  );
}
