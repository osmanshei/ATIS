import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";

export default async function AdmissionLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);

  const { data: admission } = await supabase
    .from("admissions")
    .select(
      "id,registration_number,admission_number,first_name,middle_name,last_name,status,admission_confirmed_date,admission_date,allotted_class_id,applied_for_class_id,admission_type,remarks",
    )
    .eq("id", id)
    .single();

  if (!admission || !["admitted", "enrolled"].includes(admission.status)) notFound();

  const classId = admission.allotted_class_id || admission.applied_for_class_id;
  const [{ data: school }, { data: cls }, { data: year }] = await Promise.all([
    supabase
      .from("schools")
      .select("name,short_name,address,phone,email,website")
      .eq("id", profile.school_id)
      .single(),
    supabase.from("classes").select("class_name,section").eq("id", classId).single(),
    supabase
      .from("academic_years")
      .select("name")
      .eq("school_id", profile.school_id)
      .eq("is_current", true)
      .single(),
  ]);

  const fullName = [
    admission.first_name,
    admission.middle_name,
    admission.last_name,
  ].filter(Boolean).join(" ");
  const className = cls
    ? `${cls.class_name}${cls.section ? ` / ${cls.section}` : ""}`
    : "the assigned class";

  return (
    <div className="letter-shell">
      <div className="letter-toolbar no-print">
        <Link className="button secondary" href="/admissions">Back</Link>
        <PrintButton label="Print admission letter" />
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
          <span>Ref: {admission.admission_number}</span>
          <span>Date: {admission.admission_confirmed_date || admission.admission_date}</span>
        </div>

        <h2>ADMISSION LETTER</h2>

        <p>Dear Parent/Guardian,</p>

        <p>
          We are pleased to inform you that <strong>{fullName}</strong> has been
          offered admission to <strong>{className}</strong> at{" "}
          <strong>{school?.short_name || "ATIS"}</strong> for the{" "}
          <strong>{year?.name || "current"}</strong> academic year.
        </p>

        <p>
          Admission Number: <strong>{admission.admission_number}</strong><br />
          Registration Number: <strong>{admission.registration_number}</strong><br />
          Admission Type: <strong>{admission.admission_type || "Fresh"}</strong>
        </p>

        <p>
          The parent/guardian is kindly requested to complete all required school
          formalities and ensure that the learner reports in accordance with the
          school&apos;s reporting arrangements and regulations.
        </p>

        <p>
          We look forward to welcoming the learner into the ATIS community and to
          working together toward strong knowledge, skills and discipline.
        </p>

        <div className="letter-signature">
          <div>
            <div className="signature-line" />
            <strong>Administrator / Head of School</strong>
            <p>{school?.short_name || "ATIS"}</p>
          </div>
          <div>
            <div className="signature-line" />
            <strong>Parent / Guardian</strong>
            <p>Acceptance</p>
          </div>
        </div>
      </article>
    </div>
  );
}
