import { readXls } from "xls-reader";

export type DeviceAttendanceImportRow = {
  device_user_id: string;
  staff_name: string;
  attendance_date: string;
  check_in_time: string;
  check_out_time: string;
  status: "present";
  device_record_id: string;
};

type Period = {
  start: Date;
  end: Date;
};

function textOf(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "code" in value) {
    return String((value as { code?: unknown }).code || "");
  }
  return String(value).trim();
}

function normalizeHeader(value: unknown) {
  return textOf(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parsePeriod(rows: unknown[][]): Period | null {
  const periodRegex =
    /(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\s*~\s*(?:(20\d{2})[\/-])?(\d{1,2})[\/-](\d{1,2})/;

  for (const row of rows) {
    for (const cell of row) {
      const match = textOf(cell).match(periodRegex);
      if (!match) continue;

      const startYear = Number(match[1]);
      const startMonth = Number(match[2]);
      const startDay = Number(match[3]);
      const endYear = Number(match[4] || match[1]);
      const endMonth = Number(match[5]);
      const endDay = Number(match[6]);

      return {
        start: new Date(Date.UTC(startYear, startMonth - 1, startDay)),
        end: new Date(Date.UTC(endYear, endMonth - 1, endDay)),
      };
    }
  }

  return null;
}

function parseDay(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31) {
    return value;
  }

  const text = textOf(value);
  const match = text.match(/^0?(\d{1,2})(?:\s+(?:su|mo|tu|we|th|fr|sa))?$/i);
  if (!match) return null;

  const day = Number(match[1]);
  return day >= 1 && day <= 31 ? day : null;
}

function parseTime(value: unknown): string | null {
  if (value instanceof Date) {
    return (
      String(value.getUTCHours()).padStart(2, "0") +
      ":" +
      String(value.getUTCMinutes()).padStart(2, "0") +
      ":" +
      String(value.getUTCSeconds()).padStart(2, "0")
    );
  }

  if (typeof value === "number" && value >= 0 && value < 1) {
    const seconds = Math.round(value * 24 * 60 * 60);
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return (
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(secs).padStart(2, "0")
    );
  }

  const text = textOf(value);
  if (!text) return null;

  const matches = Array.from(
    text.matchAll(/(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s|$)/g),
  );

  const times = matches
    .map((match) => {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      const second = Number(match[3] || 0);
      if (hour > 23 || minute > 59 || second > 59) return null;
      return {
        seconds: hour * 3600 + minute * 60 + second,
        text:
          String(hour).padStart(2, "0") +
          ":" +
          String(minute).padStart(2, "0") +
          ":" +
          String(second).padStart(2, "0"),
      };
    })
    .filter(Boolean) as Array<{ seconds: number; text: string }>;

  if (!times.length) return null;
  times.sort((a, b) => a.seconds - b.seconds);
  return times[0].text;
}

function dateForDay(period: Period, day: number) {
  const startYear = period.start.getUTCFullYear();
  const startMonth = period.start.getUTCMonth();
  const startDay = period.start.getUTCDate();

  let date = new Date(Date.UTC(startYear, startMonth, day));
  if (day < startDay) {
    date = new Date(Date.UTC(startYear, startMonth + 1, day));
  }

  if (date < period.start || date > period.end) return null;
  return date.toISOString().slice(0, 10);
}

function findDayColumns(rows: unknown[][], aroundRow: number) {
  let best = new Map<number, number>();

  const start = Math.max(0, aroundRow - 8);
  const end = Math.min(rows.length - 1, aroundRow + 8);

  for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
    const current = new Map<number, number>();
    const row = rows[rowIndex] || [];

    row.forEach((cell, colIndex) => {
      const day = parseDay(cell);
      if (day !== null) current.set(colIndex, day);
    });

    if (current.size > best.size) best = current;
  }

  return best;
}

function looksLikePersonName(value: string) {
  const text = value.trim();
  if (!text || text.length < 2 || text.length > 80) return false;

  const blocked = new Set([
    "name",
    "department",
    "dep.",
    "school",
    "atis",
    "summary",
    "logs",
    "attendance report",
    "attendance table",
    "shift table",
    "printed",
    "period",
  ]);

  if (blocked.has(text.toLowerCase())) return false;
  if (/^20\d{2}[\/-]/.test(text)) return false;
  if (/^\d+(?:\.\d+)*$/.test(text)) return false;

  return /[a-z]/i.test(text);
}

function parseBlockAttendanceReportSheet(
  rows: unknown[][],
  sheetName: string,
): DeviceAttendanceImportRow[] {
  const period = parsePeriod(rows);
  if (!period) return [];

  const imported: DeviceAttendanceImportRow[] = [];

  rows.forEach((nameHeaderRow, nameHeaderIndex) => {
    nameHeaderRow.forEach((cell, nameHeaderCol) => {
      if (normalizeHeader(cell) !== "name") return;

      const staffName = textOf(nameHeaderRow[nameHeaderCol + 1]);
      if (!looksLikePersonName(staffName)) return;

      // The device prints Name and Date headings on adjacent rows.
      // Find the nearest Date-heading row around this employee header.
      let dateHeaderRowIndex = -1;
      let dateColumns: number[] = [];
      let bestDistance = Number.POSITIVE_INFINITY;

      for (
        let candidateRowIndex = Math.max(0, nameHeaderIndex - 1);
        candidateRowIndex <= Math.min(rows.length - 1, nameHeaderIndex + 2);
        candidateRowIndex += 1
      ) {
        const candidate = rows[candidateRowIndex] || [];
        const columns = candidate
          .map((value, colIndex) => ({ value: normalizeHeader(value), colIndex }))
          .filter((item) => item.value === "date")
          .map((item) => item.colIndex);
        const preceding = columns.filter((col) => col < nameHeaderCol);
        const distance = Math.abs(candidateRowIndex - nameHeaderIndex);

        if (preceding.length && distance < bestDistance) {
          dateHeaderRowIndex = candidateRowIndex;
          dateColumns = columns.sort((a, b) => a - b);
          bestDistance = distance;
        }
      }

      if (dateHeaderRowIndex < 0) return;

      const dateCol = dateColumns.filter((col) => col < nameHeaderCol).at(-1);
      if (dateCol === undefined) return;

      const nextDateCol = dateColumns.find((col) => col > dateCol);
      const blockEnd = nextDateCol ?? Math.max(...rows.map((row) => row.length));

      // The first In column in each employee block is the AM clock-in column;
      // later In columns belong to PM and overtime sections.
      let checkInCol = -1;
      const headerSearchEnd = Math.min(rows.length, dateHeaderRowIndex + 12);
      for (
        let rowIndex = dateHeaderRowIndex + 1;
        rowIndex < headerSearchEnd;
        rowIndex += 1
      ) {
        const row = rows[rowIndex] || [];
        const inColumns = row
          .map((value, colIndex) => ({ value: normalizeHeader(value), colIndex }))
          .filter(
            (item) =>
              item.value === "in" &&
              item.colIndex >= dateCol &&
              item.colIndex < blockEnd,
          )
          .map((item) => item.colIndex);

        if (inColumns.length) {
          checkInCol = Math.min(...inColumns);
          break;
        }
      }
      if (checkInCol < 0) return;

      // The device's No value is directly below the Name heading.
      const identifierRow = rows[dateHeaderRowIndex] || [];
      const identifierLabel = normalizeHeader(identifierRow[nameHeaderCol]);
      const deviceUserId =
        ["no", "number", "id", "card", "userid"].includes(identifierLabel)
          ? textOf(identifierRow[nameHeaderCol + 1])
          : staffName;

      for (let rowIndex = dateHeaderRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] || [];
        const day = parseDay(row[dateCol]);
        if (day === null) continue;

        const attendanceDate = dateForDay(period, day);
        const checkIn = parseTime(row[checkInCol]);
        if (!attendanceDate || !checkIn) continue;

        imported.push({
          device_user_id: deviceUserId || staffName,
          staff_name: staffName,
          attendance_date: attendanceDate,
          check_in_time: checkIn,
          check_out_time: "",
          status: "present",
          device_record_id:
            sheetName +
            ":" +
            staffName +
            ":" +
            attendanceDate +
            ":" +
            checkIn,
        });
      }
    });
  });

  return imported;
}

function parseSummaryLikeSheet(
  rows: unknown[][],
  sheetName: string,
): DeviceAttendanceImportRow[] {
  const period = parsePeriod(rows);
  if (!period) return [];

  let bestHeaderIndex = -1;
  let bestNameColumn = -1;
  let bestCardColumn = -1;
  let bestDayColumns = new Map<number, number>();

  rows.forEach((row, rowIndex) => {
    const headers = row.map(normalizeHeader);
    const nameColumn = headers.findIndex((header) => header === "name");
    if (nameColumn < 0) return;

    const dayColumns = findDayColumns(rows, rowIndex);
    if (dayColumns.size < 5) return;

    const cardColumn = headers.findIndex((header) =>
      ["card", "no", "number", "id", "userid"].includes(header),
    );

    if (dayColumns.size > bestDayColumns.size) {
      bestHeaderIndex = rowIndex;
      bestNameColumn = nameColumn;
      bestCardColumn = cardColumn;
      bestDayColumns = dayColumns;
    }
  });

  if (bestHeaderIndex < 0 || bestNameColumn < 0 || bestDayColumns.size < 5) {
    return [];
  }

  const imported: DeviceAttendanceImportRow[] = [];

  for (let rowIndex = bestHeaderIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const staffName = textOf(row[bestNameColumn]);

    if (!looksLikePersonName(staffName)) continue;

    const rawIdentifier =
      bestCardColumn >= 0 ? textOf(row[bestCardColumn]) : "";
    let rowRecords = 0;

    for (const [colIndex, day] of bestDayColumns.entries()) {
      const checkIn = parseTime(row[colIndex]);
      if (!checkIn) continue;

      const attendanceDate = dateForDay(period, day);
      if (!attendanceDate) continue;

      imported.push({
        device_user_id: rawIdentifier || staffName,
        staff_name: staffName,
        attendance_date: attendanceDate,
        check_in_time: checkIn,
        check_out_time: "",
        status: "present",
        device_record_id:
          sheetName +
          ":" +
          staffName +
          ":" +
          attendanceDate +
          ":" +
          checkIn,
      });
      rowRecords += 1;
    }

    if (!rowRecords) {
      // The device report sometimes repeats summary-only rows before the
      // attendance-time matrix. Those rows are intentionally ignored.
      continue;
    }
  }

  return imported;
}

function parseTimeMatrixWithoutHeader(
  rows: unknown[][],
  sheetName: string,
): DeviceAttendanceImportRow[] {
  const period = parsePeriod(rows);
  if (!period) return [];

  const imported: DeviceAttendanceImportRow[] = [];

  rows.forEach((row, rowIndex) => {
    const dayColumns = findDayColumns(rows, rowIndex);
    if (dayColumns.size < 5) return;

    const parsedTimes = Array.from(dayColumns.entries())
      .map(([colIndex, day]) => ({
        colIndex,
        day,
        time: parseTime(row[colIndex]),
      }))
      .filter((item) => item.time !== null) as Array<{
        colIndex: number;
        day: number;
        time: string;
      }>;

    if (parsedTimes.length < 3) return;

    const firstTimeCol = Math.min(...parsedTimes.map((item) => item.colIndex));
    const candidateTexts = row
      .slice(0, firstTimeCol)
      .map(textOf)
      .filter(looksLikePersonName)
      .filter((value) => value.toLowerCase() !== "school");

    if (!candidateTexts.length) return;

    const staffName = candidateTexts[0];

    parsedTimes.forEach((item) => {
      const attendanceDate = dateForDay(period, item.day);
      if (!attendanceDate) return;

      imported.push({
        device_user_id: staffName,
        staff_name: staffName,
        attendance_date: attendanceDate,
        check_in_time: item.time,
        check_out_time: "",
        status: "present",
        device_record_id:
          sheetName +
          ":" +
          staffName +
          ":" +
          attendanceDate +
          ":" +
          item.time,
      });
    });
  });

  return imported;
}

function deduplicate(rows: DeviceAttendanceImportRow[]) {
  const map = new Map<string, DeviceAttendanceImportRow>();

  for (const row of rows) {
    const key =
      row.staff_name.toLowerCase().replace(/\s+/g, " ").trim() +
      "|" +
      row.attendance_date;

    const existing = map.get(key);
    if (!existing || row.check_in_time < existing.check_in_time) {
      map.set(key, row);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.attendance_date !== b.attendance_date) {
      return a.attendance_date.localeCompare(b.attendance_date);
    }
    return a.staff_name.localeCompare(b.staff_name);
  });
}

export function parseLegacyAttendanceXls(bytes: Uint8Array) {
  const workbook = readXls(bytes);

  const preferred = workbook.sheets
    .filter((sheet) => sheet.visibility === "visible")
    .sort((a, b) => {
      const aSummary = a.name.trim().toLowerCase() === "summary" ? 0 : 1;
      const bSummary = b.name.trim().toLowerCase() === "summary" ? 0 : 1;
      return aSummary - bSummary;
    });

  const all: DeviceAttendanceImportRow[] = [];

  for (const sheet of preferred) {
    const blockRows = parseBlockAttendanceReportSheet(
      sheet.rows as unknown[][],
      sheet.name,
    );
    if (blockRows.length) {
      all.push(...blockRows);
      continue;
    }

    const matrixRows = parseSummaryLikeSheet(
      sheet.rows as unknown[][],
      sheet.name,
    );
    if (matrixRows.length) {
      all.push(...matrixRows);
      continue;
    }

    const fallbackRows = parseTimeMatrixWithoutHeader(
      sheet.rows as unknown[][],
      sheet.name,
    );
    if (fallbackRows.length) all.push(...fallbackRows);
  }

  const result = deduplicate(all);

  if (!result.length) {
    throw new Error(
      "ATIS could not find the daily staff clock-in matrix in this XLS attendance report.",
    );
  }

  return result;
}
