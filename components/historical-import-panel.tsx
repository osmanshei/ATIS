"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  commitHistoricalImportAction,
  previewHistoricalImportAction,
} from "@/app/(protected)/historical-imports/actions";
import type {
  HistoricalImportPreview,
  HistoricalImportRow,
  HistoricalImportType,
} from "@/lib/historical-import-types";

type Props = {
  importType: HistoricalImportType;
  title: string;
  description: string;
  valueLabel: string;
  templateHref: string;
};

function displayValue(row: HistoricalImportRow, importType: HistoricalImportType) {
  if (row.value === null) return row.rawValue || "—";
  if (importType === "fee_arrears") return "GHS " + row.value.toFixed(2);
  return row.value.toLocaleString();
}

export function HistoricalImportPanel({
  importType,
  title,
  description,
  valueLabel,
  templateHref,
}: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<HistoricalImportPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const matchedCount = preview?.rows.filter((row) => row.status === "matched").length || 0;
  const skippedCount = preview ? preview.totalRows - matchedCount : 0;

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setPreview(null);
    setBusy("preview");

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("import_type", importType);
      const result = await previewHistoricalImportAction(formData);
      if (result.ok) {
        setPreview(result);
      } else {
        setNotice({ kind: "error", text: result.message });
      }
    } catch {
      setNotice({ kind: "error", text: "The file could not be previewed. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!preview || matchedCount < 1) return;
    setNotice(null);
    setBusy("import");

    try {
      const result = await commitHistoricalImportAction(
        importType,
        preview.fileName,
        preview.totalRows,
        preview.rows,
      );

      if (result.ok) {
        setNotice({ kind: "success", text: result.message });
        setPreview(null);
        setFile(null);
        router.refresh();
      } else {
        setNotice({ kind: "error", text: result.message });
      }
    } catch {
      setNotice({ kind: "error", text: "The import could not be completed. Please preview the file again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="form-card">
      <div className="section-heading">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <a className="text-link" href={templateHref} download>
          Download CSV template
        </a>
      </div>

      <form onSubmit={handlePreview}>
        <div className="field">
          <label>CSV or Excel file</label>
          <input
            name="file"
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setPreview(null);
              setNotice(null);
            }}
          />
          <small className="muted">Maximum file size: 5 MB. Up to 1,500 student rows per import.</small>
        </div>
        <button className="button" type="submit" disabled={!file || busy !== null}>
          {busy === "preview" ? "Checking records..." : "Preview records"}
        </button>
      </form>

      {notice ? (
        <div className={notice.kind === "success" ? "notice success" : "notice error"} style={{ marginTop: 14 }}>
          {notice.text}
        </div>
      ) : null}

      {preview ? (
        <div className="panel-section" style={{ marginTop: 18 }}>
          <div className="teacher-summary-grid">
            <div className="metric-card">
              <span className="metric-kicker">Rows in file</span>
              <strong>{preview.totalRows}</strong>
              <small>{preview.fileName}</small>
            </div>
            <div className="metric-card">
              <span className="metric-kicker">Matched</span>
              <strong>{matchedCount}</strong>
              <small>Ready to import</small>
            </div>
            <div className="metric-card">
              <span className="metric-kicker">Skipped</span>
              <strong>{skippedCount}</strong>
              <small>Need correction or review</small>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>{valueLabel}</th>
                  <th>Match status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 40).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td><strong>{row.name || "—"}</strong></td>
                    <td>{row.className || "—"}</td>
                    <td>{displayValue(row, importType)}</td>
                    <td>
                      <span className={row.status === "matched" ? "tag" : "tag gray"}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.rows.length > 40 ? (
            <p className="muted">Showing the first 40 of {preview.rows.length} rows. All matched rows are included in the import.</p>
          ) : null}

          <p className="muted">
            Only matched rows will be saved. If you import the same student again, the new value replaces the previously imported value; it is not added to it.
          </p>

          <button
            className="button"
            type="button"
            onClick={handleImport}
            disabled={matchedCount < 1 || busy !== null}
          >
            {busy === "import" ? "Importing..." : "Confirm import of " + matchedCount + " records"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
