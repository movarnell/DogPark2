import { useEffect, useState } from "react";
import { api, Report } from "../lib/api";
import { HumanType } from "../types/HumanType";

function Moderation({ signedInUser }: { signedInUser: HumanType | null }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (signedInUser?.role !== "admin") return;
    api
      .getReports()
      .then(setReports)
      .catch((error: Error) => setMessage(error.message));
  }, [signedInUser?.role]);

  async function updateReport(id: string, status: string) {
    await api.updateReport(id, { status });
    setReports((current) => current.map((report) => (report.id === id ? { ...report, status } : report)));
  }

  if (signedInUser?.role !== "admin") {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">Admin access is required.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Moderation</p>
        <h1 className="mt-1 text-3xl font-black">Reports queue</h1>
        {message && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">{message}</p>}
      </section>
      <section className="mt-6 grid gap-4">
        {reports.map((report) => (
          <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm" key={report.id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-stone-500">{report.target_type} · {report.status}</p>
                <h2 className="mt-1 text-xl font-black">{report.reason}</h2>
                <p className="mt-2 text-stone-700">{report.details || "No extra details provided."}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-bold text-white" type="button" aria-label={`Resolve report: ${report.reason}`} onClick={() => updateReport(report.id, "resolved")}>
                  Resolve
                </button>
                <button className="rounded-md border border-stone-300 px-3 py-2 text-sm font-bold" type="button" aria-label={`Dismiss report: ${report.reason}`} onClick={() => updateReport(report.id, "dismissed")}>
                  Dismiss
                </button>
              </div>
            </div>
          </article>
        ))}
        {reports.length === 0 && <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">No reports in the queue.</div>}
      </section>
    </main>
  );
}

export default Moderation;
