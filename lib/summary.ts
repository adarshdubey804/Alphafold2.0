import type { SummaryPayload } from "./pipeline/types";

export const PLACEHOLDER_VALUE = "N/A";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize uploaded/loaded JSON into a dashboard-compatible summary object.
 * Matches Python `normalize_summary_data` behavior in dashboard/app.py.
 */
export function normalizeSummaryData(rawData: unknown): SummaryPayload {
  if (isPlainRecord(rawData)) {
    const normalized: Record<string, unknown> = { ...rawData };
    if (Array.isArray(normalized.hits)) {
      normalized.hits = normalized.hits.filter((item) => isPlainRecord(item));
    } else {
      normalized.hits = [];
    }
    if (!Array.isArray(normalized.pockets)) {
      normalized.pockets = [];
    }
    return normalized as SummaryPayload;
  }

  if (Array.isArray(rawData) && rawData.every((item) => isPlainRecord(item))) {
    return {
      target: PLACEHOLDER_VALUE,
      target_pdb_id: PLACEHOLDER_VALUE,
      structure: {},
      pockets: [],
      hits: rawData,
      mode: "uploaded-hits-only",
    };
  }

  throw new Error(
    "Unsupported JSON format. Upload a summary object or a list of hit objects."
  );
}

/**
 * Flatten a nested JSON object using dot-notation keys, mirroring `pandas.json_normalize`.
 */
export function flattenRecord(
  record: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainRecord(value) && Object.keys(value).length > 0) {
      Object.assign(result, flattenRecord(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

export function normalizeHitsTable(hits: Record<string, unknown>[]): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const flattenedRows = hits.map((hit) => flattenRecord(hit));
  const columnSet = new Set<string>();
  for (const row of flattenedRows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key);
    }
  }
  return {
    columns: Array.from(columnSet),
    rows: flattenedRows,
  };
}

/**
 * Sort hit rows with fallback to normalized string ordering for mixed/non-orderable values.
 * Matches Python `sort_hits_dataframe` behavior in dashboard/app.py.
 */
export function sortHitsRows(
  rows: Record<string, unknown>[],
  sortCol: string,
  ascending: boolean
): Record<string, unknown>[] {
  const direction = ascending ? 1 : -1;

  const nonEmptyValues = rows
    .map((r) => r[sortCol])
    .filter((v) => v !== null && v !== undefined && v !== "");

  const allNumeric =
    nonEmptyValues.length > 0 &&
    nonEmptyValues.every((v) => typeof v === "number" && !Number.isNaN(v));

  const allBoolean =
    nonEmptyValues.length > 0 &&
    nonEmptyValues.every((v) => typeof v === "boolean");

  return [...rows].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];

    if (allNumeric) {
      const aMissing = av === null || av === undefined || av === "";
      const bMissing = bv === null || bv === undefined || bv === "";
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return ((av as number) - (bv as number)) * direction;
    }

    if (allBoolean) {
      const aNum = av ? 1 : 0;
      const bNum = bv ? 1 : 0;
      return (aNum - bNum) * direction;
    }

    const aStr = av === null || av === undefined ? "" : String(av);
    const bStr = bv === null || bv === undefined ? "" : String(bv);
    return aStr.localeCompare(bStr) * direction;
  });
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
