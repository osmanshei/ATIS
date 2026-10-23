"use client";

import { useActionState } from "react";
import {
  bulkOnboardStaffAction,
  initialStaffBulkState,
} from "@/app/(protected)/staff/onboarding/actions";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}

export function StaffBulkOnboarding() {
  const [state, action, pending] = useActionState(
    bulkOnboardStaffAction,
    initialStaffBulkState,
  );

  function downloadCredentials() {
    if (!state.credentials.length) return;
    const header = [
      "Full Name","Employee Code","Role","Position","Email","Phone",
      "Username","Temporary Password","SMS Sent","Email Sent"
    ];
    const rows = state.credentials.map((x) => [
      x.fullName,x.employeeCode,x.role,x.position,x.email,x.phone,
      x.username,x.temporaryPassword,x.smsSent ? "Yes" : "No",x.emailSent ? "Yes" : "No"
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ATIS_New_Staff_Login_Credentials.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <form className="form-card" action={action}>
        <h2 className="section-title">Staff / Teacher CSV Import</h2>
        <p className="muted">
          Required: Full Name, Phone Number and Email. Role and every other field are optional.
          Leave Role blank to default to Teacher.
        </p>
        <div className="field">
          <label>CSV file</label>
          <input name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Onboarding staff..." : "Onboard staff"}
        </button>
      </form>

      {state.message ? (
        <div className={state.ok ? "notice success" : "notice error"}>{state.message}</div>
      ) : null}

      {state.credentials.length ? (
        <>
          <div className="page-head" style={{ marginTop: 22 }}>
            <div>
              <h2>New Login Credentials</h2>
              <p>Save or hand these over now. Temporary passwords are not stored in ATIS.</p>
            </div>
            <button className="button secondary" type="button" onClick={downloadCredentials}>
              Download credentials CSV
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th><th>Employee Code</th><th>Role / Position</th>
                  <th>Username</th><th>Temporary Password</th><th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {state.credentials.map((row) => (
                  <tr key={row.employeeCode}>
                    <td><strong>{row.fullName}</strong><br /><span className="muted">{row.email}</span></td>
                    <td>{row.employeeCode}</td>
                    <td>{row.role}<br /><span className="muted">{row.position}</span></td>
                    <td><strong>{row.username}</strong></td>
                    <td><strong>{row.temporaryPassword}</strong></td>
                    <td>SMS: {row.smsSent ? "Yes" : "No"}<br />Email: {row.emailSent ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
