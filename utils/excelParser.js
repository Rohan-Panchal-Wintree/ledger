import xlsx from "xlsx";
export const parseExcelFile = (buffer) => {
	const workbook = xlsx.read(buffer, {
		type: "buffer",
		cellDates: true,
	});

	const sheet = workbook.Sheets[workbook.SheetNames[0]];

	const raw = xlsx.utils.sheet_to_json(sheet, {
		header: 1,
		defval: "",
		raw: false,
	});

	const normalizeHeaderCell = (value) =>
		String(value || "")
			.replace(/\s+/g, " ")
			.trim()
			.toUpperCase();

	const headerRowIndex = raw.findIndex((row) => {
		const normalized = row.map(normalizeHeaderCell);
		return normalized.includes("MERCHANT NAME") && normalized.includes("MID");
	});

	const data = xlsx.utils.sheet_to_json(sheet, {
		range: headerRowIndex,
		defval: "",
		raw: false,
	});

	return data.map((row) => {
		const normalizedRow = {};
		for (const key in row) {
			normalizedRow[String(key).replace(/\s+/g, " ").trim().toUpperCase()] =
				row[key];
		}
		return normalizedRow;
	});
};

export const extractWorkbookBankName = (buffer) => {
	const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
	const firstSheet = workbook.SheetNames[0];
	const sheet = workbook.Sheets[firstSheet];

	const rawRows = xlsx.utils.sheet_to_json(sheet, {
		header: 1,
		defval: "",
		raw: false,
	});

	return String(rawRows[1]?.[0] || "")
		.replace(/\s+/g, " ")
		.trim();
};
