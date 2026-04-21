import xlsx from "xlsx";

const args = process.argv.slice(2);
const maybeSheetIndex = args[args.length - 1];
const hasSheetIndex = /^\d+$/.test(maybeSheetIndex);
const requestedSheetIndex = hasSheetIndex ? Number(maybeSheetIndex) : 0;
const filePath = args
  .slice(0, hasSheetIndex ? -1 : undefined)
  .join(" ")
  .replace(/^"+|"+$/g, "");

if (!filePath) {
  console.error("Usage: node scripts/inspect-xlsx.js <path>");
  process.exit(1);
}

const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[requestedSheetIndex] || workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(sheet, {
  defval: "",
  raw: false
});
const rawRows = xlsx.utils.sheet_to_json(sheet, {
  header: 1,
  defval: "",
  raw: false
});

console.log("SHEETS", JSON.stringify(workbook.SheetNames));
console.log("SHEET", sheetName);
console.log("ROW_COUNT", rows.length);
console.log("HEADERS", JSON.stringify(Object.keys(rows[0] || {})));
console.log("FIRST_ROW", JSON.stringify(rows[0] || {}, null, 2));
console.log("RAW_PREVIEW", JSON.stringify(rawRows.slice(0, 12), null, 2));

const headerRowIndex = rawRows.findIndex((row) => {
  const normalized = row.map((cell) =>
    String(cell || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase()
  );
  return normalized.includes("MERCHANT NAME") && normalized.includes("MID");
});

if (headerRowIndex >= 0) {
  const dataRows = xlsx.utils.sheet_to_json(sheet, {
    range: headerRowIndex,
    defval: "",
    raw: false
  });
  console.log("HEADER_ROW_INDEX", headerRowIndex);
  console.log("DATA_HEADERS", JSON.stringify(Object.keys(dataRows[0] || {})));
  console.log("DATA_FIRST_ROWS", JSON.stringify(dataRows.slice(0, 3), null, 2));
}
