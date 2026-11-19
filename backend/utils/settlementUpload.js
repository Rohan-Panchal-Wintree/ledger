import xlsx from "xlsx";

const uploadError = (message) => {
	const error = new Error(message);
	error.statusCode = 400;
	throw error;
};

export const parseSettlementReportDate = (value) => {
	const text = String(value ?? "").trim();
	const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
	if (!slash && !iso) return null;
	const [day, month, year] = slash
		? [Number(slash[1]), Number(slash[2]), Number(slash[3])]
		: [Number(iso[3]), Number(iso[2]), Number(iso[1])];
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
		? date : null;
};

export const parseSettlementUploadPeriod = (body = {}) => {
	const readDate = (value, label) => {
		if (!String(value ?? "").trim()) return null;
		const date = parseSettlementReportDate(value);
		if (!date) uploadError(`Invalid ${label}. Use DD/MM/YYYY or YYYY-MM-DD.`);
		return date;
	};
	const rawReportDate = String(body.reportDate ?? "").trim();
	const datePattern = "(?:\\d{2}/\\d{2}/\\d{4}|\\d{4}-\\d{2}-\\d{2})";
	const range = new RegExp(`^(${datePattern})\\s+(?:-|–|—|to)\\s+(${datePattern})$`, "i").exec(rawReportDate);
	let fromDate = readDate(body.fromDate, "fromDate");
	let toDate = readDate(body.toDate, "toDate");
	let reportDate;
	if (range) {
		// Compatibility with clients that previously put the display range in reportDate.
		const rangeStart = readDate(range[1], "reportDate range start");
		const rangeEnd = readDate(range[2], "reportDate range end");
		if ((fromDate && +fromDate !== +rangeStart) || (toDate && +toDate !== +rangeEnd)) {
			uploadError("reportDate range conflicts with fromDate or toDate.");
		}
		fromDate = rangeStart;
		toDate = rangeEnd;
		reportDate = rangeEnd;
	} else {
		reportDate = readDate(rawReportDate, "reportDate");
	}
	if (Boolean(fromDate) !== Boolean(toDate)) uploadError("Provide both fromDate and toDate for a settlement period.");
	if (fromDate && fromDate > toDate) uploadError("fromDate must be on or before toDate.");
	return { reportDate: reportDate || toDate, fromDate, toDate };
};

export const isSettlementTransactionFilename = (name) => /\.(csv|xlsx)$/i.test(String(name ?? ""));

const sourceDate = (year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) => {
	const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day &&
		date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second
		? date : null;
};

// Excel clock values have no timezone. UTC carries their original components;
// it must not be used to convert them from the machine's local timezone.
export const parseSettlementTransactionDate = (value) => {
	if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value) : null;
	const text = String(value ?? "").trim();
	if (!text) return null;
	const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/.exec(text);
	// Transaction exports explicitly label slash dates as MM/DD/YYYY.
	const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(AM|PM)?)?$/i.exec(text);
	if (iso || slash) {
		const parts = iso || slash;
		const [year, month, day] = iso
			? parts.slice(1, 4).map(Number) : [Number(parts[3]), Number(parts[1]), Number(parts[2])];
		let hour = Number(parts[4] || 0);
		if (slash?.[8]) {
			if (hour < 1 || hour > 12) return null;
			hour = hour % 12 + (slash[8].toUpperCase() === "PM" ? 12 : 0);
		}
		return sourceDate(year, month, day, hour, Number(parts[5] || 0), Number(parts[6] || 0),
			Number((parts[7] || "").padEnd(3, "0")));
	}
	// Explicit offsets retain their existing instant-based meaning.
	if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
		const date = new Date(text);
		return Number.isFinite(date.getTime()) ? date : null;
	}
	return null;
};

export const settlementDateToExcelCell = (value) => {
	const date = parseSettlementTransactionDate(value);
	if (!date) return null;
	// Write a numeric Excel date directly, avoiding SheetJS's local Date conversion.
	return { t: "n", v: (date.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000, z: "yyyy-mm-dd hh:mm:ss" };
};

export const formatSettlementReportDate = (value, timeZone = "UTC") => {
	if (!value) return "-";
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return "-";
	return date.toLocaleDateString("en-GB", { timeZone, day: "2-digit", month: "short", year: "numeric" });
};

const normalizeHeader = (value) => String(value ?? "").replace(/_\d+$/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const isDateHeader = (value) => /^(DATESTAMP|DATE STAMP|TIMESTAMP|TIME STAMP|TRANSACTION DATE(?:\s*\(.*\))?)$/.test(normalizeHeader(value));

export const SETTLEMENT_ACQUIRER_HEADERS = ["Acquirer", "Acquirer-wise", "Acquirer Name"];
export const SETTLEMENT_ROW_LOCATION = Symbol("settlementRowLocation");

export const validateSettlementAcquirerHeader = ({ headers, sheetName, rowNumber, columnOffset = 0 }) => {
	const accepted = SETTLEMENT_ACQUIRER_HEADERS.map(normalizeHeader);
	if (headers.some((header) => accepted.includes(normalizeHeader(header)))) return;
	const column = headers.findIndex((header) => normalizeHeader(header).includes("ACQUIRER"));
	const location = sheetName
		? `sheet "${sheetName}", ${column >= 0 ? `cell ${xlsx.utils.encode_col(column + columnOffset)}${rowNumber}` : `row ${rowNumber}`}`
		: `CSV line ${rowNumber}${column >= 0 ? `, column ${column + 1}` : ""}`;
	if (column >= 0) {
		uploadError(`${location}: header "${String(headers[column]).trim()}" is not recognized. Rename it to "Acquirer-wise".`);
	}
	uploadError(`${location}: missing acquirer column. Add "Acquirer-wise", "Acquirer", or "Acquirer Name" and fill in the acquirer values.`);
};

// Iterate worksheet cells rather than materializing a second array of all rows.
// SheetJS loads the XLSX workbook; CSV uploads retain their streaming reader.
export function* iterateXlsxSettlementRows(filePath, { onHeader } = {}) {
	// Keep Excel serials numeric. cellDates:true uses the host timezone and can
	// move midnight transactions into the previous day (and alter seconds).
	const workbook = xlsx.readFile(filePath, { cellDates: false, cellNF: true });
	let foundHeader = false;
	for (const sheetName of workbook.SheetNames) {
		const sheet = workbook.Sheets[sheetName];
		if (!sheet["!ref"]) continue;
		const range = xlsx.utils.decode_range(sheet["!ref"]);
		let headers;
		for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
			const cells = [];
			for (let col = range.s.c; col <= range.e.c; col++) cells.push(sheet[xlsx.utils.encode_cell({ r: rowIndex, c: col })]);
			const values = cells.map((cell) => cell?.v ?? "");
			const labels = values.map(normalizeHeader);
			const isHeader = labels.some(isDateHeader) && ["MEMBER ID", "CURRENCY", "STATUS"].every((key) => labels.includes(key));
			if (isHeader) {
				onHeader?.({ headers: values, sheetName, rowNumber: rowIndex + 1, columnOffset: range.s.c });
				headers = labels;
				foundHeader = true;
				continue;
			}
			if (!headers || values.every((value) => String(value).trim() === "")) continue;
			const row = {};
			for (let index = 0; index < headers.length; index++) {
				const header = headers[index];
				const cell = cells[index];
				if (!header) continue;
				let value = cell ? xlsx.utils.format_cell(cell) : "";
				if (cell && isDateHeader(header) && String(cell.v ?? "").trim()) {
					let date;
					if (typeof cell.v === "number") {
						const parts = xlsx.SSF.parse_date_code(cell.v, { date1904: Boolean(workbook.Workbook?.WBProps?.date1904) });
						if (parts) date = sourceDate(parts.y, parts.m, parts.d, parts.H, parts.M, parts.S, Math.min(999, Math.round(parts.u * 1000)));
					} else date = parseSettlementTransactionDate(cell.v);
					if (!date) uploadError(`Invalid Excel transaction date in ${sheetName}, row ${rowIndex + 1}. Use an Excel date, MM/DD/YYYY, or an ISO date.`);
					value = date.toISOString();
				}
				// Duplicate headers use the first nonempty value, matching the CSV normalizer.
				if (!String(row[header] ?? "").trim()) row[header] = value;
			}
			Object.defineProperty(row, SETTLEMENT_ROW_LOCATION, { value: { sheetName, rowNumber: rowIndex + 1 } });
			yield row;
		}
	}
	if (!foundHeader) uploadError("Could not find an XLSX transaction header row containing date, Member ID, Currency and Status.");
}
