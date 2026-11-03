import { requireProfile } from "@/lib/auth";
import { HistoricalImportPanel } from "@/components/historical-import-panel";

function importLabel(type: string) {
  return type === "fee_arrears" ? "Fee arrears" : "Historical attendance totals";
}

export default async function HistoricalImportsPage() {
  const { supabase } = await requireProfile(["admin"]);

  const { data: batches } = await supabase
    .from("historical_import_batches")
    .select("id,import_type,file_name,total_rows,imported_rows,skipped_rows,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Administration · data migration</div>
          <h1>Historical Data Import</h1>
          <p>Bring existing student fee arrears and cumulative attendance totals into ATIS.</p>
        </div>
      </div>

      <div className="notice">
        Match students using their full name and class as recorded in ATIS. If a class has sections, include the section in the Class column. The preview flags unmatched, ambiguous and duplicate rows before anything is saved.
      </div>

      <div className="grid-2">
        <HistoricalImportPanel
          importType="fee_arrears"
          title="Import Fee Arrears"
          description="Upload the opening amount each student still owes from earlier terms. This is stored separately from current-term fee billing."
          valueLabel="Arrears (GHS)"
          templateHref="/templates/historical-fee-arrears.csv"
        />
        <HistoricalImportPanel
          importType="attendance_totals"
          title="Import Historical Attendance"
          description="Upload each student's aggregate attendance total from before ATIS daily attendance registers were introduced."
          valueLabel="Total attendance"
          templateHref="/templates/historical-attendance-totals.csv"
        />
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Audit trail</div>
            <h2>Recent import history</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Import type</th>
                <th>File</th>
                <th>Total rows</th>
                <th>Imported</th>
                <th>Skipped</th>
              </tr>
            </thead>
            <tbody>
              {(batches || []).map((batch: any) => (
                <tr key={batch.id}>
                  <td>{new Date(batch.created_at).toLocaleString("en-GH")}</td>
                  <td><strong>{importLabel(batch.import_type)}</strong></td>
                  <td>{batch.file_name}</td>
                  <td>{batch.total_rows}</td>
                  <td>{batch.imported_rows}</td>
                  <td>{batch.skipped_rows}</td>
                </tr>
              ))}
              {!batches?.length ? (
                <tr><td colSpan={6} className="muted">No historical imports have been completed yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
