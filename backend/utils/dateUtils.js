const buildUtcDate = (year, month, day, hours = 0, minutes = 0, seconds = 0) =>
	new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

export const parseSheetDate = (value) => {
	if (!value) return null;

	if (value instanceof Date) {
		const parsedDate = buildUtcDate(
			value.getFullYear(),
			value.getMonth() + 1,
			value.getDate(),
			value.getHours(),
			value.getMinutes(),
			value.getSeconds(),
		);

		return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
	}

	const normalized = String(value).trim();

	// Format: MM/DD/YY or MM/DD/YY HH:mm:ss
	const twoDigitYearMatch = normalized.match(
		/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
	);

	if (twoDigitYearMatch) {
		const [, month, day, year, hours = "0", minutes = "0", seconds = "0"] =
			twoDigitYearMatch;

		const parsedDate = buildUtcDate(
			2000 + Number(year),
			Number(month),
			Number(day),
			Number(hours),
			Number(minutes),
			Number(seconds),
		);

		return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
	}

	// Format: DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
	const fullYearMatch = normalized.match(
		/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
	);

	if (fullYearMatch) {
		const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] =
			fullYearMatch;

		const parsedDate = buildUtcDate(
			Number(year),
			Number(month),
			Number(day),
			Number(hours),
			Number(minutes),
			Number(seconds),
		);

		return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
	}

	// Format: DD.MM.YYYY or DD.MM.YYYY HH:mm:ss
	const dotFullYearMatch = normalized.match(
		/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
	);

	if (dotFullYearMatch) {
		const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] =
			dotFullYearMatch;

		const parsedDate = buildUtcDate(
			Number(year),
			Number(month),
			Number(day),
			Number(hours),
			Number(minutes),
			Number(seconds),
		);

		return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
	}

	const parsedDate = new Date(value);

	return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const startOfDay = (date) => {
	const value = new Date(date);
	value.setUTCHours(0, 0, 0, 0);
	return value;
};

export const endOfDay = (date) => {
	const value = new Date(date);
	value.setUTCHours(23, 59, 59, 999);
	return value;
};

// export const parseFlexibleSheetDate = (value) => {
// 	if (!value) return null;

// 	if (typeof value === "number") {
// 		const excelEpoch = Date.UTC(1899, 11, 30);
// 		const milliseconds = value * 24 * 60 * 60 * 1000;
// 		const date = new Date(excelEpoch + milliseconds);

// 		return Number.isNaN(date.getTime()) ? null : date;
// 	}

// 	if (value instanceof Date && !Number.isNaN(value.getTime())) {
// 		return buildUtcDate(
// 			value.getFullYear(),
// 			value.getMonth() + 1,
// 			value.getDate(),
// 			value.getHours(),
// 			value.getMinutes(),
// 			value.getSeconds(),
// 		);
// 	}

// 	const normalized = String(value)
// 		.trim()
// 		.replace(/\s+/g, " ")
// 		.replace(/\(([^)]*)\)/g, " $1")
// 		.trim();

// 	const patterns = [
// 		/^(\d{1,2})-(\d{1,2})-(\d{2,4})(?:\s+(\d{1,2})[:.](\d{1,2})(?::?(\d{1,2}))?)?$/,
// 		/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2})[:.](\d{1,2})(?::?(\d{1,2}))?)?$/,
// 		/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2})[:.](\d{1,2})(?::?(\d{1,2}))?)?$/,
// 	];

// 	for (const pattern of patterns) {
// 		const match = normalized.match(pattern);
// 		if (!match) continue;

// 		const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] =
// 			match;

// 		const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);

// 		const parsedDate = buildUtcDate(
// 			fullYear,
// 			Number(month),
// 			Number(day),
// 			Number(hours),
// 			Number(minutes),
// 			Number(seconds),
// 		);

// 		return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
// 	}

// 	return null;
// };

export const parseFlexibleSheetDate = (value) => {
	if (!value) return null;

	if (typeof value === "number") {
		const excelEpoch = Date.UTC(1899, 11, 30);
		const milliseconds = value * 24 * 60 * 60 * 1000;
		const date = new Date(excelEpoch + milliseconds);

		return Number.isNaN(date.getTime()) ? null : date;
	}

	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return buildUtcDate(
			value.getFullYear(),
			value.getMonth() + 1,
			value.getDate(),
			value.getHours(),
			value.getMinutes(),
			value.getSeconds(),
		);
	}

	const normalized = String(value)
		.trim()
		.replace(/\s+/g, " ")
		.replace(/\(([^)]*)\)/g, " $1")
		.trim();

	const patterns = [
		/^(\d{1,2})-(\d{1,2})-(\d{2,4})(?:\s+(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?)?$/,
		/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?)?$/,
		/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?)?$/,
	];

	for (const pattern of patterns) {
		const match = normalized.match(pattern);

		if (!match) continue;

		const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] =
			match;

		const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);

		const parsedDate = buildUtcDate(
			fullYear,
			Number(month),
			Number(day),
			Number(hours),
			Number(minutes),
			Number(seconds),
		);

		return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
	}

	return null;
};
