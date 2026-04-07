import xlsx from "xlsx";
import { ApiError } from "./ApiError.js";

const normalizeHeaderCell = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const getWorkbookSheet = (buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new ApiError(400, "Uploaded workbook is empty");
  }

  const sheet = workbook.Sheets[firstSheet];
  const rawRows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false
  });

  return { sheet, rawRows };
};

export const parseExcelFile = (buffer) => {
  const { sheet, rawRows } = getWorkbookSheet(buffer);

  const headerRowIndex = rawRows.findIndex((row) => {
    const normalized = row.map(normalizeHeaderCell);
    return normalized.includes("MERCHANT NAME") && normalized.includes("MID");
  });

  const sheetToParse =
    headerRowIndex >= 0
      ? xlsx.utils.sheet_to_json(sheet, {
          range: headerRowIndex,
          defval: "",
          raw: false
        })
      : xlsx.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false
        });

  return sheetToParse.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [String(key).replace(/\s+/g, " ").trim(), value])
    )
  );
};

export const extractWorkbookBankName = (buffer) => {
  const { rawRows } = getWorkbookSheet(buffer);
  return String(rawRows[1]?.[0] || "").replace(/\s+/g, " ").trim();
};
