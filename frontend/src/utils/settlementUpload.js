const isoDate = (value) => {
  const text = String(value ?? "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error("Please select a valid settlement date.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error("Please select a valid settlement date.");
  }
  return text;
};

const displayDate = (value) => value.split("-").reverse().join("/");

export const buildSettlementUploadPeriod = (mode, value) => {
  const fromDate = isoDate(mode === "range" ? value?.startDate : value);
  const toDate = isoDate(mode === "range" ? value?.endDate : value);
  if (fromDate > toDate) throw new Error("Settlement start date must be on or before the end date.");
  const label = mode === "range" ? `${displayDate(fromDate)} - ${displayDate(toDate)}` : displayDate(toDate);
  return { reportDate: toDate, fromDate, toDate, batchName: `${label} Settlement` };
};

export const createSettlementUploadFormData = ({ datestampFile, timestampFile, reportDate = "", fromDate = "", toDate = "", batchName = "" } = {}) => {
  if (!datestampFile && !timestampFile) throw new Error("Please select at least one settlement transaction file.");
  if (!reportDate) throw new Error("Report date is required.");
  if (!batchName) throw new Error("Batch name is required.");
  if (Boolean(fromDate) !== Boolean(toDate)) throw new Error("Provide both start and end dates for the settlement period.");
  if (fromDate && isoDate(fromDate) > isoDate(toDate)) throw new Error("Settlement start date must be on or before the end date.");
  const formData = new FormData();
  if (datestampFile) formData.append("datestampFile", datestampFile);
  if (timestampFile) formData.append("timestampFile", timestampFile);
  formData.append("reportDate", reportDate);
  formData.append("batchName", batchName);
  if (fromDate) formData.append("fromDate", fromDate);
  if (toDate) formData.append("toDate", toDate);
  return formData;
};
