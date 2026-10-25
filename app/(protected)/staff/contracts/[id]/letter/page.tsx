import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";

export default async function StaffAppointmentLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);

  const { data: contract } = await supabase
    .from("staff_contract_summary")
    .select("*")
    .eq("id", id)
    .single();

  if (!contract || contract.status === "draft") notFound();

  const { data: school } = await supabase
    .from("schools")
    .select("name,short_name,address,phone,email,website")
    .eq("id", profile.school_id)
    .single();

  return (
    <div className="letter-shell">
      <div className="letter-toolbar no-print">
        <Link className="button secondary" href="/staff/contracts">Back</Link>
        <PrintButton label="Print appointment letter" />
      </div>

      <article className="letter-page">
        <header className="letter-header">
          <Image src="/atis-logo.svg" alt="ATIS" width={76} height={76} />
          <div>
            <h1>{school?.name || "AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL"}</h1>
            <p>{school?.address || "Bimbilla, Northern Region - Ghana"}</p>
            <p>{[school?.phone, school?.email].filter(Boolean).join(" · ")}</p>
          </div>
        </header>

        <div className="letter-meta">
          <span>Ref: {contract.contract_no}</span>
          <span>Date: {contract.start_date}</span>
        </div>

        <h2>APPOINTMENT LETTER</h2>

        <p>Dear <strong>{contract.full_name}</strong>,</p>

        <p>
          We are pleased to confirm your appointment with{" "}
          <strong>{school?.name || "AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL"}</strong> as{" "}
          <strong>{contract.position_title}</strong>, effective{" "}
          <strong>{contract.start_date}</strong>.
        </p>

        <p>
          Your employment type is <strong>{String(contract.employment_type).replaceAll("_", " ")}</strong>
          {contract.end_date ? <> and the current term of appointment ends on <strong>{contract.end_date}</strong></> : null}.
          {contract.probation_end_date ? <> Your probation period runs until <strong>{contract.probation_end_date}</strong>.</> : null}
        </p>

        <p>
          Base salary: <strong>GHS {Number(contract.base_salary || 0).toFixed(2)}</strong><br />
          Assigned class / responsibility: <strong>{contract.assigned_class || contract.subjects || "As assigned by management"}</strong><br />
          Reporting to: <strong>{contract.reporting_to || "School Management"}</strong><br />
          Work location: <strong>{contract.work_location || "ATIS"}</strong>
        </p>

        {contract.working_hours ? <p>Working hours: <strong>{contract.working_hours}</strong></p> : null}
        {contract.notice_period ? <p>Notice period: <strong>{contract.notice_period}</strong></p> : null}
        {contract.benefits_notes ? <p>Benefits / additional conditions: {contract.benefits_notes}</p> : null}

        <p>
          You are expected to carry out your responsibilities diligently and in accordance
          with the policies, professional standards, values and disciplinary requirements
          of the school.
        </p>

        <p>
          Kindly sign the acceptance section below to confirm your acceptance of this appointment
          and its stated conditions.
        </p>

        <div className="letter-signature">
          <div>
            <div className="signature-line" />
            <strong>Administrator / Head of School</strong>
            <p>{school?.short_name || "ATIS"}</p>
          </div>
          <div>
            <div className="signature-line" />
            <strong>{contract.full_name}</strong>
            <p>Staff Acceptance / Date</p>
          </div>
        </div>
      </article>
    </div>
  );
}
