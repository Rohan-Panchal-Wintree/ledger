// Settlement timestamps carry the calendar date from the source export.
// Browser timezone conversion must not move transactions to another day.
export const formatSettlementDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
};
