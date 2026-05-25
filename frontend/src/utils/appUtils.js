export function formatNumber(value) {
  const number = Number(value);

  if (Number.isNaN(number)) return "0.00";

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toISOString().slice(0, 10);
}

export function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
}

export function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

export function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isNaN(number) ? fallback : number;
}
