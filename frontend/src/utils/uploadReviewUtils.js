const REVIEW_PAGE_SIZE_STORAGE_KEY = "global-table-rows-per-page";

export const getInitialReviewPageSize = () => {
  if (typeof window === "undefined") return 50;

  const storedValue = Number(
    window.localStorage.getItem(REVIEW_PAGE_SIZE_STORAGE_KEY),
  );

  return [25, 50, 100].includes(storedValue) ? storedValue : 50;
};

const getFirstDefinedValue = (...values) => {
  return values.find((value) => value !== undefined && value !== null);
};

const padDatePart = (value) => String(value).padStart(2, "0");

const formatDatePartsForBackend = (day, month, year) => {
  if (!day || !month || !year) return undefined;

  return `${padDatePart(day)}.${padDatePart(month)}.${year}`;
};

export const normalizeDateForBackend = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDatePartsForBackend(
      value.getDate(),
      value.getMonth() + 1,
      value.getFullYear(),
    );
  }

  const rawValue = String(value).trim();

  if (!rawValue) return undefined;

  /**
   * Handles:
   * 2026-05-23
   * 2026-05-23T00:00:00.000Z
   */
  const isoMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return formatDatePartsForBackend(day, month, year);
  }

  /**
   * Handles:
   * 23.05.2026
   * 23/05/2026
   * 23-05-2026
   */
  const dayFirstMatch = rawValue.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return formatDatePartsForBackend(day, month, year);
  }

  /**
   * Fallback:
   * If your modal already sends a backend-compatible custom value,
   * do not destroy it.
   */
  return rawValue;
};

export const buildUnmatchedPaymentUpdatePayload = (updatedData) => {
  const sourceStartDate = normalizeDateForBackend(
    getFirstDefinedValue(
      updatedData.sourceStartDate,
      updatedData.startDate,
      updatedData.firstDate,
    ),
  );

  const sourceEndDate = normalizeDateForBackend(
    getFirstDefinedValue(updatedData.sourceEndDate, updatedData.endDate),
  );

  return {
    paymentBank: updatedData.paymentBank,
    merchantName: updatedData.merchantName,

    sourceMid: getFirstDefinedValue(updatedData.sourceMid, updatedData.mid),

    sourceStartDate,
    sourceEndDate,

    sourceProcessingCurrency: getFirstDefinedValue(
      updatedData.sourceProcessingCurrency,
      updatedData.processingCurrency,
    ),

    amountPaid: updatedData.amountPaid,

    paymentRate: getFirstDefinedValue(
      updatedData.paymentRate,
      updatedData.rate,
    ),

    settlementCurrency: getFirstDefinedValue(
      updatedData.settlementCurrency,
      updatedData.paymentCurrency,
    ),

    settlementAmount: updatedData.settlementAmount,
  };
};

export const createInitialUploadState = (initialTabState) => ({
  wire: { ...initialTabState },
  payment: { ...initialTabState },
});

export const createTabLoadingState = () => ({
  wire: false,
  payment: false,
});
