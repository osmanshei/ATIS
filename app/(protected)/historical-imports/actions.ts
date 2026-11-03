"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { field, normalizeHeader, parseCsv, type CsvRecord } from "@/lib/csv";
import { readSheet } from "read-excel-file/universal";
import { readXls } from "xls-reader";
import type {
  HistoricalImportCommitResult,
  HistoricalImportPreview,
  HistoricalImportRow,
  HistoricalImportType,
} from "@/lib/historical-import-types";

function normalizeText(value: string) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

function safeFileName(value: string) {
  return String(value || "historical-import")
    .replace(/[\\/\u0000-\u001f]/g, "_")
    .trim()
    .slice(0, 255);
}

function failedPreview(
  importType: HistoricalImportType,
  message: string,
  fileName = "",
): HistoricalImportPreview {
  return { ok: false, message, importType, fileName, totalRows: 0, rows: [] };
}

function rowsToRecords(rows: unknown[][]): CsvRecord[] {
  if (!rows.length) return [];
  const headers = rows[0].map((value) => normalizeHeader(String(value ?? "")));
  return rows
    .slice(1)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, String(row[index] ?? "").trim()]),
      ) as CsvRecord,
    );
}

async function readImportRecords(
  file: File,
  importType: HistoricalImportType,
): Promise<CsvRecord[]> {
  const extension = file.name.toLowerCase().split(".").pop() || "";

  if (extension === "csv") {
    return parseCsv(await file.text());
  }

  const bytes = await file.arrayBuffer();
  const expectedSheet = importType === "fee_arrears" ? "Fee Arrears" : "Attendance Totals";

  if (extension === "xls") {
    const workbook = readXls(new Uint8Array(bytes));
    const sheet =
      workbook.sheets.find((item) => normalizeText(item.name) === normalizeText(expectedSheet)) ||
      workbook.sheets.find((item) => item.visibility === "visible") ||
      workbook.sheets[0];
    return rowsToRecords((sheet?.rows || []) as unknown[][]);
  }

  if (extension === "xlsx") {
    let rows: unknown[][];
    try {
      rows = (await readSheet(bytes, { sheet: expectedSheet })) as unknown[][];
    } catch {
      rows = (await readSheet(bytes)) as unknown[][];
    }
    return rowsToRecords(rows);
  }

  throw new Error("Use a CSV, XLS or XLSX file.");
}

function parseImportValue(rawValue: string, importType: HistoricalImportType) {
  const cleaned = String(rawValue || "")
    .replace(/GHS|GH¢|₵/gi, "")
    .replace(/,/g, "")
    .trim();

  if (!cleaned) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  if (importType === "attendance_totals" && !Number.isInteger(value)) return null;
  return value;
}

export async function previewHistoricalImportAction(
  formData: FormData,
): Promise<HistoricalImportPreview> {
  const rawType = String(formData.get("import_type") || "");
  const importType: HistoricalImportType =
    rawType === "attendance_totals" ? "attendance_totals" : "fee_arrears";

  if (rawType !== "fee_arrears" && rawType !== "attendance_totals") {
    return failedPreview(importType, "Choose a valid import type.");
  }

  await requireProfile(["admin"]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return failedPreview(importType, "Choose a CSV or Excel file.");
  }
  if (file.size > 5_000_000) {
    return failedPreview(importType, "The file is too large. The limit is 5 MB.", safeFileName(file.name));
  }

  let records: CsvRecord[];
  try {
    records = await readImportRecords(file, importType);
  } catch {
    return failedPreview(
      importType,
      "The file could not be read. Use a valid CSV, XLS or XLSX file and the correct worksheet.",
      safeFileName(file.name),
    );
  }

  if (!records.length) {
    return failedPreview(
      importType,
      "No data rows were found. Check that the first row contains the required column headings.",
      safeFileName(file.name),
    );
  }
  if (records.length > 1500) {
    return failedPreview(
      importType,
      "This import is limited to 1,500 rows at a time.",
      safeFileName(file.name),
    );
  }

  const [{ data: classes, error: classError }, { data: students, error: studentError }] =
    await Promise.all([
      (await requireProfile(["admin"])).supabase
        .from("classes")
        .select("id,class_name,section,class_code")
        .eq("is_active", true),
      (await requireProfile(["admin"])).supabase
        .from("students")
        .select("id,first_name,middle_name,last_name,class_id"),
    ]);

  if (classError || studentError) {
    return failedPreview(
      importType,
      classError?.message || studentError?.message || "Student records could not be loaded.",
      safeFileName(file.name),
    );
  }

  const classIndex = new Map<string, string[]>();
  function addClassLabel(label: string, id: string) {
    const key = normalizeText(label);
    if (!key) return;
    const current = classIndex.get(key) || [];
    if (!current.includes(id)) current.push(id);
    classIndex.set(key, current);
  }

  for (const item of classes || []) {
    addClassLabel(item.class_name, item.id);
    if (item.class_code) addClassLabel(item.class_code, item.id);
    if (item.section) {
      addClassLabel(item.class_name + " " + item.section, item.id);
      addClassLabel(item.class_name + " / " + item.section, item.id);
      addClassLabel(item.class_name + "/" + item.section, item.id);
    }
  }

  const studentIndex = new Map<string, any[]>();
  for (const student of students || []) {
    if (!student.class_id) continue;
    const fullName = [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ");
    const key = student.class_id + "::" + normalizeText(fullName);
    const current = studentIndex.get(key) || [];
    current.push(student);
    studentIndex.set(key, current);
  }

  const seenStudentIds = new Set<string>();
  const rows: HistoricalImportRow[] = records.map((record, index) => {
    const name = field(record, "Name", "Student Name", "Full Name");
    const className = field(record, "Class", "Class Name");
    const rawValue =
      importType === "fee_arrears"
        ? field(record, "Arrears", "Arrears Amount", "Amount")
        : field(record, "Total Attendance", "Attendance Total", "Attendance");
    const value = parseImportValue(rawValue, importType);

    const base = {
      rowNumber: index + 2,
      name,
      className,
      rawValue,
      value,
      studentId: null as string | null,
      classId: null as string | null,
    };

    if (!name || !className || !rawValue || value === null) {
      return {
        ...base,
        status: "invalid",
        message:
          importType === "fee_arrears"
            ? "Name, Class and a non-negative arrears amount are required."
            : "Name, Class and a non-negative whole-number attendance total are required.",
      };
    }

    const classMatches = classIndex.get(normalizeText(className)) || [];
    if (!classMatches.length) {
      return { ...base, status: "unmatched", message: "Class was not found in ATIS." };
    }
    if (classMatches.length > 1) {
      return {
        ...base,
        status: "ambiguous",
        message: "This class name has multiple sections. Include the section in the Class column.",
      };
    }

    const classId = classMatches[0];
    const studentMatches = studentIndex.get(classId + "::" + normalizeText(name)) || [];
    if (!studentMatches.length) {
      return { ...base, classId, status: "unmatched", message: "No student with this name was found in this class." };
    }
    if (studentMatches.length > 1) {
      return {
        ...base,
        classId,
        status: "ambiguous",
        message: "More than one student has this name in this class. Review the student record before importing.",
      };
    }

    const studentId = studentMatches[0].id as string;
    if (seenStudentIds.has(studentId)) {
      return {
        ...base,
        studentId,
        classId,
        status: "duplicate",
        message: "This student appears more than once in the uploaded file.",
      };
    }

    seenStudentIds.add(studentId);
    return {
      ...base,
      studentId,
      classId,
      status: "matched",
      message: "Matched to an ATIS student record.",
    };
  });

  return {
    ok: true,
    message: "Preview ready. Only matched rows can be imported.",
    importType,
    fileName: safeFileName(file.name),
    totalRows: rows.length,
    rows,
  };
}

export async function commitHistoricalImportAction(
  importType: HistoricalImportType,
  fileName: string,
  totalRows: number,
  rows: HistoricalImportRow[],
): Promise<HistoricalImportCommitResult> {
  const { supabase } = await requireProfile(["admin"]);

  if (importType !== "fee_arrears" && importType !== "attendance_totals") {
    return { ok: false, message: "Choose a valid import type." };
  }
  if (!Array.isArray(rows) || rows.length !== totalRows || totalRows < 1 || totalRows > 1500) {
    return { ok: false, message: "The preview has expired or is incomplete. Please preview the file again." };
  }

  const matched = rows.filter((row) => row.status === "matched");
  if (!matched.length) {
    return { ok: false, message: "There are no matched rows to import." };
  }

  const seen = new Set<string>();
  const payload = [];

  for (const row of matched) {
    if (!row.studentId || !row.classId || row.value === null || !Number.isFinite(row.value) || row.value < 0) {
      return { ok: false, message: "A matched row contains an invalid value. Preview the file again." };
    }
    if (importType === "attendance_totals" && !Number.isInteger(row.value)) {
      return { ok: false, message: "Attendance totals must be whole numbers." };
    }
    if (seen.has(row.studentId)) {
      return { ok: false, message: "A student appears more than once in the import. Preview the file again." };
    }
    seen.add(row.studentId);
    payload.push({
      student_id: row.studentId,
      class_id: row.classId,
      value: row.value,
    });
  }

  const { data, error } = await supabase.rpc("import_historical_records", {
    p_import_type: importType,
    p_file_name: safeFileName(fileName),
    p_rows: payload,
    p_total_rows: totalRows,
    p_skipped_rows: totalRows - matched.length,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/historical-imports");
  revalidatePath("/finance");
  revalidatePath("/finance/balances");
  revalidatePath("/attendance/reports");

  const result = data as {
    batch_id?: string;
    imported_rows?: number;
    skipped_rows?: number;
  } | null;

  const importedRows = Number(result?.imported_rows ?? matched.length);
  const skippedRows = Number(result?.skipped_rows ?? totalRows - matched.length);

  return {
    ok: true,
    message:
      "Imported " +
      importedRows +
      " records. Skipped " +
      skippedRows +
      " unmatched, ambiguous, duplicate or invalid rows.",
    batchId: result?.batch_id,
    importedRows,
    skippedRows,
  };
}
