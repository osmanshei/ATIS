import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PortalAccessManager } from "@/components/portal-access-manager";

export default async function StudentPortalAccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireProfile(["admin"]);

  const [{ data: student }, { data: links }] = await Promise.all([
    supabase
      .from("students")
      .select("id,user_id,admission_number,first_name,middle_name,last_name")
      .eq("id", id)
      .single(),
    supabase
      .from("student_guardians")
      .select(
        "guardian_id,relation,is_primary_contact,guardians(id,user_id,full_name,email,mobile,status)",
      )
      .eq("student_id", id)
      .order("is_primary_contact", { ascending: false }),
  ]);

  if (!student) notFound();

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");

  const guardians = (links || [])
    .map((link: any) => {
      const g = Array.isArray(link.guardians) ? link.guardians[0] : link.guardians;
      if (!g) return null;
      return {
        id: g.id,
        fullName: g.full_name,
        relation: link.relation || "Guardian",
        mobile: g.mobile || "",
        email: g.email || "",
        hasLogin: Boolean(g.user_id),
        primary: Boolean(link.is_primary_contact),
      };
    })
    .filter(Boolean) as any[];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Student · portal access</div>
          <h1>Portal Login Management</h1>
          <p>{fullName} · {student.admission_number || "No admission number"}</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href={"/students/" + id + "/edit"}>Edit Student</Link>
          <Link className="button secondary" href="/students">Back to students</Link>
        </div>
      </div>

      <div className="notice">
        Temporary passwords are shown only when generated. Parent accounts automatically see every student linked to that same guardian record.
      </div>

      <PortalAccessManager
        student={{ id: student.id, fullName, hasLogin: Boolean(student.user_id) }}
        guardians={guardians}
      />
    </>
  );
}
