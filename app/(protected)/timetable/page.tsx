import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { TimetableEntryForm } from "@/components/timetable-entry-form";
import { deactivateTimetableEntryAction } from "./actions";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

function buildTimetableHref(args: {
  termId: string;
  viewMode: "class" | "teacher";
  classId?: string;
  teacherId?: string;
  editId?: string;
}) {
  const p = new URLSearchParams();
  if (args.termId) p.set("term", args.termId);
  p.set("view", args.viewMode);
  if (args.classId) p.set("class", args.classId);
  if (args.teacherId) p.set("teacher", args.teacherId);
  if (args.editId) p.set("edit", args.editId);
  return "/timetable?" + p.toString();
}

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{
    term?: string;
    view?: string;
    class?: string;
    teacher?: string;
    edit?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "teacher"]);
  const query = await searchParams;
  const canEdit = profile.role === "admin" || profile.role === "supervisor";

  const [{ data: terms }, { data: years }] = await Promise.all([
    supabase
      .from("terms")
      .select("id,name,is_current,academic_year_id,starts_on,ends_on")
      .order("starts_on", { ascending: false }),
    supabase
      .from("academic_years")
      .select("id,name,is_current")
      .order("starts_on", { ascending: false }),
  ]);

  const selectedTerm =
    (terms || []).find((t: any) => t.id === query.term) ||
    (terms || []).find((t: any) => t.is_current) ||
    (terms || [])[0] ||
    null;

  if (!selectedTerm) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">Academic scheduling</div>
            <h1>Timetable</h1>
            <p>Configure an academic year and term before creating a timetable.</p>
          </div>
        </div>
        <div className="notice">No academic term is available.</div>
      </>
    );
  }

  const yearName =
    (years || []).find((y: any) => y.id === selectedTerm.academic_year_id)?.name || "";

  const [{ data: classes }, { data: teachers }, { data: periods }] = await Promise.all([
    supabase
      .from("classes")
      .select("id,class_name,section,grade_level")
      .eq("academic_year_id", selectedTerm.academic_year_id)
      .eq("is_active", true)
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
    canEdit
      ? supabase
          .from("staff")
          .select("id,full_name,employee_code")
          .eq("role", "teacher")
          .eq("status", "active")
          .order("full_name")
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("school_periods")
      .select("id,period_number,start_time,end_time,is_break,label,display_order,day_type")
      .eq("academic_year_id", selectedTerm.academic_year_id)
      .eq("day_type", "regular")
      .eq("is_active", true)
      .order("display_order")
      .order("start_time"),
  ]);

  let ownTeacherId = "";
  if (!canEdit) {
    const { data: ownStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("user_id", profile.user_id)
      .maybeSingle();
    ownTeacherId = ownStaff?.id || "";
  }

  const viewMode: "class" | "teacher" =
    !canEdit || query.view === "teacher" ? "teacher" : "class";

  const selectedClassId =
    viewMode === "class"
      ? (classes || []).find((c: any) => c.id === query.class)?.id ||
        (classes || [])[0]?.id ||
        ""
      : "";

  const selectedTeacherId =
    viewMode === "teacher"
      ? canEdit
        ? (teachers || []).find((t: any) => t.id === query.teacher)?.id ||
          (teachers || [])[0]?.id ||
          ""
        : ownTeacherId
      : "";

  let assignmentsQuery = supabase
    .from("teacher_assignment_summary")
    .select(
      "id,teacher_id,teacher_name,employee_code,class_subject_id,class_id,class_name,section,subject_id,subject_name,subject_code,academic_year_id,periods_per_week",
    )
    .eq("academic_year_id", selectedTerm.academic_year_id)
    .order("class_name")
    .order("subject_name");

  if (viewMode === "class" && selectedClassId) {
    assignmentsQuery = assignmentsQuery.eq("class_id", selectedClassId);
  } else if (viewMode === "teacher" && selectedTeacherId) {
    assignmentsQuery = assignmentsQuery.eq("teacher_id", selectedTeacherId);
  }

  const { data: assignments } = await assignmentsQuery;
  const classSubjectIds = Array.from(
    new Set((assignments || []).map((a: any) => a.class_subject_id).filter(Boolean)),
  );

  const { data: aspects } = classSubjectIds.length
    ? await supabase
        .from("class_subject_aspect_summary")
        .select(
          "id,class_subject_id,subject_aspect_id,aspect_name,aspect_code,periods_per_week,is_active,aspect_is_active",
        )
        .in("class_subject_id", classSubjectIds)
        .eq("is_active", true)
        .eq("aspect_is_active", true)
        .order("display_order")
    : { data: [] as any[] };

  let entriesQuery = supabase
    .from("timetable_entry_summary")
    .select(
      "id,term_id,class_id,class_name,section,teacher_id,teacher_name,teacher_assignment_id,class_subject_id,subject_name,subject_code,class_subject_aspect_id,aspect_name,day_of_week,period_id,period_number,period_label,start_time,end_time,display_order,room_number,mode,meeting_link,notes,is_active",
    )
    .eq("term_id", selectedTerm.id)
    .eq("is_active", true)
    .order("display_order")
    .order("day_of_week");

  if (viewMode === "class" && selectedClassId) {
    entriesQuery = entriesQuery.eq("class_id", selectedClassId);
  } else if (viewMode === "teacher" && selectedTeacherId) {
    entriesQuery = entriesQuery.eq("teacher_id", selectedTeacherId);
  }

  const { data: entries, error: entriesError } = await entriesQuery;

  const editingEntry =
    canEdit && query.edit
      ? (
          await supabase
            .from("timetable_entries")
            .select(
              "id,teacher_assignment_id,class_subject_aspect_id,day_of_week,period_id,room_number,mode,meeting_link,notes",
            )
            .eq("id", query.edit)
            .maybeSingle()
        ).data
      : null;

  const classRecord = (classes || []).find((c: any) => c.id === selectedClassId);
  const teacherRecord = canEdit
    ? (teachers || []).find((t: any) => t.id === selectedTeacherId)
    : { id: selectedTeacherId, full_name: profile.full_name, employee_code: "" };

  const targetLabel =
    viewMode === "class"
      ? classRecord
        ? classRecord.class_name + (classRecord.section ? " / " + classRecord.section : "")
        : "No class selected"
      : teacherRecord?.full_name || "No teacher selected";

  const entryMap = new Map<string, any>();
  for (const entry of entries || []) {
    entryMap.set(entry.period_id + ":" + entry.day_of_week, entry);
  }

  const baseHref = buildTimetableHref({
    termId: selectedTerm.id,
    viewMode,
    classId: selectedClassId,
    teacherId: selectedTeacherId,
  });

  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="eyebrow">
            {canEdit ? "Academic scheduling" : "Teacher workspace"}
          </div>
          <h1>{canEdit ? "Timetable & Scheduling" : "My Timetable"}</h1>
          <p>
            {canEdit
              ? "Schedule main subjects or their teaching aspects with automatic class, teacher and room clash checks."
              : "Your assigned lessons for the selected term."}
          </p>
        </div>
        <div className="action-row">
          {canEdit ? (
            <Link className="button secondary" href="/timetable/periods">Period Setup</Link>
          ) : null}
          {canEdit ? (
            <Link className="button secondary" href="/subjects">Subject Aspects</Link>
          ) : null}
          <PrintButton label="Print Timetable" />
        </div>
      </div>

      {query.ok ? <div className="notice success no-print">{query.ok}</div> : null}
      {query.error ? <div className="notice error no-print">{query.error}</div> : null}
      {entriesError ? <div className="notice error no-print">{entriesError.message}</div> : null}

      <form className="form-card timetable-filter no-print" method="get">
        <div className="field">
          <label>Term</label>
          <select name="term" defaultValue={selectedTerm.id}>
            {(terms || []).map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_current ? " · Current" : ""}
              </option>
            ))}
          </select>
        </div>

        {canEdit ? (
          <>
            <div className="field">
              <label>View</label>
              <select name="view" defaultValue={viewMode}>
                <option value="class">Class timetable</option>
                <option value="teacher">Teacher timetable</option>
              </select>
            </div>
            <div className="field">
              <label>Class</label>
              <select name="class" defaultValue={selectedClassId}>
                <option value="">Choose...</option>
                {(classes || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}{c.section ? " / " + c.section : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Teacher</label>
              <select name="teacher" defaultValue={selectedTeacherId}>
                <option value="">Choose...</option>
                {(teachers || []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}{t.employee_code ? " · " + t.employee_code : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="view" value="teacher" />
            <input type="hidden" name="teacher" value={selectedTeacherId} />
          </>
        )}

        <button className="button" type="submit">View Timetable</button>
      </form>

      {!periods?.length ? (
        <div className="notice no-print">
          {canEdit ? (
            <>
              School periods have not been configured for {yearName || "this academic year"}.{" "}
              <Link href={"/timetable/periods?year=" + selectedTerm.academic_year_id}>
                Configure periods first.
              </Link>
            </>
          ) : (
            "School periods have not been configured for this academic year."
          )}
        </div>
      ) : null}

      {canEdit && periods?.length ? (
        <div className="no-print">
          <TimetableEntryForm
            assignments={(assignments || []) as any[]}
            aspects={(aspects || []) as any[]}
            periods={(periods || []) as any[]}
            termId={selectedTerm.id}
            viewMode={viewMode}
            viewClassId={selectedClassId}
            viewTeacherId={selectedTeacherId}
            editingEntry={editingEntry as any}
          />
          {editingEntry ? (
            <div className="action-row timetable-edit-cancel">
              <Link className="button secondary compact" href={baseHref}>Cancel Editing</Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="timetable-print-sheet">
        <div className="timetable-print-header">
          <div className="eyebrow">{viewMode === "class" ? "Class timetable" : "Teacher timetable"}</div>
          <h2>{targetLabel}</h2>
          <p>{yearName ? yearName + " · " : ""}{selectedTerm.name}</p>
        </div>

        <div className="table-wrap timetable-table-wrap">
          <table className="timetable-grid">
            <thead>
              <tr>
                <th className="time-col">Period / Time</th>
                {DAYS.map((day) => <th key={day.value}>{day.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(periods || []).map((period: any) => {
                const time =
                  String(period.start_time).slice(0, 5) + "–" +
                  String(period.end_time).slice(0, 5);
                if (period.is_break) {
                  return (
                    <tr key={period.id} className="timetable-break-row">
                      <td>
                        <strong>{period.label || "Break"}</strong>
                        <small>{time}</small>
                      </td>
                      <td colSpan={5}>
                        <strong>{period.label || "Break"}</strong>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={period.id}>
                    <td className="time-col">
                      <strong>{period.label || "Period " + period.period_number}</strong>
                      <small>{time}</small>
                    </td>
                    {DAYS.map((day) => {
                      const entry = entryMap.get(period.id + ":" + day.value);
                      if (!entry) {
                        return <td className="timetable-empty-cell" key={day.value}>—</td>;
                      }

                      const subjectLabel =
                        entry.subject_name +
                        (entry.aspect_name ? " — " + entry.aspect_name : "");
                      const secondary =
                        viewMode === "class"
                          ? entry.teacher_name
                          : entry.class_name + (entry.section ? " / " + entry.section : "");
                      const editHref = buildTimetableHref({
                        termId: selectedTerm.id,
                        viewMode,
                        classId: selectedClassId,
                        teacherId: selectedTeacherId,
                        editId: entry.id,
                      });

                      return (
                        <td key={day.value} className="timetable-lesson-cell">
                          <strong>{subjectLabel}</strong>
                          <span>{secondary}</span>
                          {entry.room_number ? <small>{entry.room_number}</small> : null}
                          {entry.mode !== "onsite" ? <small>{entry.mode}</small> : null}
                          {canEdit ? (
                            <div className="timetable-cell-actions no-print">
                              <Link className="button secondary compact" href={editHref}>Edit</Link>
                              <form action={deactivateTimetableEntryAction}>
                                <input type="hidden" name="timetable_entry_id" value={entry.id} />
                                <input type="hidden" name="term_id" value={selectedTerm.id} />
                                <input type="hidden" name="view_mode" value={viewMode} />
                                <input type="hidden" name="view_class_id" value={selectedClassId} />
                                <input type="hidden" name="view_teacher_id" value={selectedTeacherId} />
                                <button className="button secondary compact" type="submit">Remove</button>
                              </form>
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!periods?.length ? (
                <tr><td colSpan={6} className="muted">No school periods configured.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
