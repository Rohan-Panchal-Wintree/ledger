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
