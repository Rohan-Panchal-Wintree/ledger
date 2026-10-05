import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { merchantSettlementApi, paymentApi, wiresheetApi } from "../api";
import { dashboardQueryKeys } from "./dashboardQueries";

export const uploadQueryKeys = {
  all: ["uploads"],

  unmatchedSummary: () => [...uploadQueryKeys.all, "unmatched-summary"],

  unmatchedRows: ({
    search,
    status,
    paymentDate,
    fromDate,
    toDate,
    merchantName,
    bank,
    currency,
    page,
    limit,
  } = {}) => [
    ...uploadQueryKeys.all,
    "unmatched-rows",
    {
      search,
      status,
      paymentDate,
      fromDate,
      toDate,
      merchantName,
      bank,
      currency,
      page,
      limit,
    },
  ],
};

function extractResponseData(response, fallback) {
  return response?.data?.data ?? fallback;
}

async function uploadMerchantRatesApi(file) {
  if (!file) {
    throw new Error("Please select a rates file.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await merchantSettlementApi.post("/fees/upload", formData);

  return {
    message:
      response?.data?.message ||
      response?.data?.data?.message ||
      "Rates uploaded successfully.",

    totalRows: Number(
      response?.data?.data?.totalRows ?? response?.data?.totalRows ?? 0,
    ),

    insertedRows: Number(
      response?.data?.data?.insertedRows ?? response?.data?.insertedRows ?? 0,
    ),

    skippedRows: Number(
      response?.data?.data?.skippedRows ?? response?.data?.skippedRows ?? 0,
    ),
  };
}

async function uploadCountryMasterApi(file) {
  if (!file) {
    throw new Error("Please select a country master file.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await merchantSettlementApi.post(
    "/countries/upload",
    formData,
  );

  const data = response?.data?.data || {};

  return {
    message: response?.data?.message || "Country master uploaded successfully.",

    excelRows: Number(data.excelRows || 0),
    countryRecordsProcessed: Number(data.countryRecordsProcessed || 0),
    uniqueCountriesStored: Number(data.uniqueCountriesStored || 0),
    euColumnRows: Number(data.euColumnRows || 0),
    nonEuColumnRows: Number(data.nonEuColumnRows || 0),
    specificColumnRows: Number(data.specificColumnRows || 0),
    totalEuCountries: Number(data.totalEuCountries || 0),
    totalNonEuCountries: Number(data.totalNonEuCountries || 0),
  };
}

async function uploadSettlementBatchTransactionsApi({
  datestampFile = null,
  timestampFile = null,
  reportDate = "",
  batchName = "",
} = {}) {
  if (!datestampFile && !timestampFile) {
    throw new Error("Please select at least one settlement transaction file.");
  }

  if (!reportDate) {
    throw new Error("Report date is required.");
  }

  if (!batchName) {
    throw new Error("Batch name is required.");
  }

  const formData = new FormData();

  if (datestampFile) {
    formData.append("datestampFile", datestampFile);
  }

  if (timestampFile) {
    formData.append("timestampFile", timestampFile);
  }

  formData.append("reportDate", reportDate);
  formData.append("batchName", batchName);

  const response = await merchantSettlementApi.post(
    "/settlement-batches/upload",
    formData,
  );

  const data = response?.data?.data || {};

  return {
    message:
      response?.data?.message ||
      "Settlement transactions uploaded successfully.",

    settlementBatchId: data.settlementBatchId || null,
    files: data.files || [],
    generatedReportIds: data.generatedReportIds || [],

    totalRows: Number(data.totalRows || 0),
    validRows: Number(data.validRows || 0),
    matchedRows: Number(data.matchedRows || 0),
    unmatchedFeeRows: Number(data.unmatchedFeeRows || 0),
    skippedRows: Number(data.skippedRows || 0),
  };
}

function invalidateUploadQueries(queryClient) {
  queryClient.invalidateQueries({
    queryKey: uploadQueryKeys.all,
  });

  queryClient.invalidateQueries({
    queryKey: dashboardQueryKeys.all,
  });
}

async function getUnmatchedPaymentsSummaryApi() {
  const response = await paymentApi.get("/unmatched-summary");

  return extractResponseData(response, {
    pendingCount: 0,
    manualReviewCount: 0,
    recentRows: [],
  });
}

async function uploadFilesApi({
  wireFiles = [],
  paymentFiles = [],
  batchId,
  paymentDate,
  acquirerId,
} = {}) {
  if (wireFiles.length === 0 && paymentFiles.length === 0) {
    throw new Error("No files selected for upload");
  }

  const result = {
    wire: null,
    payments: null,
  };

  if (wireFiles.length > 0) {
    const wireFormData = new FormData();

    wireFiles.forEach((file) => {
      wireFormData.append(wireFiles.length === 1 ? "file" : "files", file);
    });

    if (acquirerId) {
      wireFormData.append("acquirerId", acquirerId);
    }

    const wireResponse = await wiresheetApi.post(
      "/upload-wiresheet",
      wireFormData,
    );

    result.wire = extractResponseData(wireResponse, wireResponse.data);
  }

  if (paymentFiles.length > 0) {
    const paymentFormData = new FormData();

    paymentFiles.forEach((file) => {
      paymentFormData.append(
        paymentFiles.length === 1 ? "file" : "files",
        file,
      );
    });

    if (batchId) {
      paymentFormData.append("batchId", batchId);
    }

    if (paymentDate) {
      paymentFormData.append("paymentDate", paymentDate);
    }

    const paymentResponse = await paymentApi.post(
      "/upload-paymentsheet",
      paymentFormData,
    );

    result.payments = extractResponseData(
      paymentResponse,
      paymentResponse.data,
    );
  }

  return result;
}

async function getUnmatchedPaymentRowsApi({
  search = "",
  status = "",
  paymentDate = "",
  fromDate = "",
  toDate = "",
  merchantName = "",
  bank = "",
  currency = "",
  page = 1,
  limit = 20,
} = {}) {
  const params = {
    page,
    limit,
  };

  const normalizedSearch = String(search).trim();
  const normalizedStatus = String(status).trim();
  const normalizedPaymentDate = String(paymentDate).trim();
  const normalizedFromDate = String(fromDate).trim();
  const normalizedToDate = String(toDate).trim();
  const normalizedMerchantName = String(merchantName).trim();
  const normalizedBank = String(bank).trim();
  const normalizedCurrency = String(currency).trim();

  if (normalizedSearch) {
    params.search = normalizedSearch;
  }

  if (normalizedStatus) {
    params.status = normalizedStatus;
  }

  if (normalizedPaymentDate) {
    params.paymentDate = normalizedPaymentDate;
  }

  if (normalizedFromDate) {
    params.fromDate = normalizedFromDate;
  }

  if (normalizedToDate) {
    params.toDate = normalizedToDate;
  }

  if (normalizedMerchantName) {
    params.merchantName = normalizedMerchantName;
  }

  if (normalizedBank) {
    params.bank = normalizedBank;
  }

  if (normalizedCurrency) {
    params.currency = normalizedCurrency;
  }

  const response = await paymentApi.get("/unmatched", {
    params,
  });

  return {
    items: response?.data?.data || [],

    summary: response?.data?.summary || {
      pendingCount: 0,
      invalidCount: 0,
      unmatchedCount: 0,
      unmatchedRows: [],
    },

    filterOptions: response?.data?.filterOptions || {
      banks: [],
      merchants: [],
      currencies: [],
    },

    meta: response?.data?.meta || {
      total: 0,
      page,
      limit,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

async function updateUnmatchedPaymentRowApi({ id, payload }) {
  const response = await paymentApi.put(`/unmatched/${id}`, payload);

  return extractResponseData(response, response.data);
}

async function reconcileUnmatchedPaymentRowsApi({ batchId } = {}) {
  const response = await paymentApi.post(
    "/reconcile-unmatched",
    batchId ? { batchId } : {},
  );

  return extractResponseData(response, response.data);
}

export function useUnmatchedPaymentsSummary() {
  return useQuery({
    queryKey: uploadQueryKeys.unmatchedSummary(),
    queryFn: getUnmatchedPaymentsSummaryApi,
  });
}

export function useUploadFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadFilesApi,

    onSuccess: () => {
      invalidateUploadQueries(queryClient);
    },
  });
}

export function useUploadMerchantRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadMerchantRatesApi,

    onSuccess: () => {
      invalidateUploadQueries(queryClient);
    },
  });
}

export function useUploadCountryMaster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadCountryMasterApi,

    onSuccess: async () => {
      invalidateUploadQueries(queryClient);

      await queryClient.invalidateQueries({
        queryKey: ["merchant-settlement", "countries"],
      });
    },
  });
}

export function useUploadSettlementBatchTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadSettlementBatchTransactionsApi,

    onSuccess: () => {
      invalidateUploadQueries(queryClient);

      queryClient.invalidateQueries({
        queryKey: ["merchant-settlement", "transactions"],
      });

      queryClient.invalidateQueries({
        queryKey: ["merchant-settlement"],
      });
    },
  });
}

export function useUnmatchedPaymentRows({
  search = "",
  status = "",
  paymentDate = "",
  fromDate = "",
  toDate = "",
  merchantName = "",
  bank = "",
  currency = "",
  page = 1,
  limit = 20,
} = {}) {
  const filters = {
    search,
    status,
    paymentDate,
    fromDate,
    toDate,
    merchantName,
    bank,
    currency,
    page,
    limit,
  };

  return useQuery({
    queryKey: uploadQueryKeys.unmatchedRows(filters),

    queryFn: () => getUnmatchedPaymentRowsApi(filters),

    placeholderData: (previousData) => previousData,
  });
}

export function useUpdateUnmatchedPaymentRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUnmatchedPaymentRowApi,

    onSuccess: () => {
      invalidateUploadQueries(queryClient);
    },
  });
}

export function useReconcileUnmatchedPaymentRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconcileUnmatchedPaymentRowsApi,

    onSuccess: () => {
      invalidateUploadQueries(queryClient);
    },
  });
}
