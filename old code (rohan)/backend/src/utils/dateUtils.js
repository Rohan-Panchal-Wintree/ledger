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
      value.getSeconds()
    );
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const normalized = String(value).trim();
  const twoDigitYearMonthFirstMatch = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (twoDigitYearMonthFirstMatch) {
    const [, month, day, year, hours = "0", minutes = "0", seconds = "0"] =
      twoDigitYearMonthFirstMatch;
    const fullYear = 2000 + Number(year);
    const parsedMonthFirst = buildUtcDate(
      fullYear,
      Number(month),
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );

    return Number.isNaN(parsedMonthFirst.getTime()) ? null : parsedMonthFirst;
  }

  const dayFirstMatch = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (dayFirstMatch) {
    const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] = dayFirstMatch;
    const parsedDayFirst = buildUtcDate(
      Number(year),
      Number(month),
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );

    return Number.isNaN(parsedDayFirst.getTime()) ? null : parsedDayFirst;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
