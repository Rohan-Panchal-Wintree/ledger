import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { paymentApi, wiresheetApi } from "../api";
import { dashboardQueryKeys } from "./dashboardQueries";

export const uploadQueryKeys = {
  all: ["uploads"],

  unmatchedSummary: () => [...uploadQueryKeys.all, "unmatched-summary"],

  unmatchedRows: ({ status, paymentSheetDate, fileName, page, limit } = {}) => [
    ...uploadQueryKeys.all,
    "unmatched-rows",
    {
      status,
      paymentSheetDate,
      fileName,
      page,
      limit,
    },
  ],
};

function extractResponseData(response, fallback) {
  return response?.data?.data ?? fallback;
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
  status = "",
  paymentSheetDate = "",
  fileName = "",
  page = 1,
  limit = 20,
} = {}) {
  const params = {
    page,
    limit,
  };

  if (status) {
    params.status = status;
  }

  if (paymentSheetDate) {
    params.paymentSheetDate = paymentSheetDate;
  }

  if (fileName) {
    params.fileName = fileName;
  }

  const response = await paymentApi.get("/unmatched", { params });

  return {
    items: response?.data?.data || [],

    summary: response?.data?.summary || {
      pendingCount: 0,
      invalidCount: 0,
      unmatchedCount: 0,
      unmatchedRows: [],
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

  console.log("response reconcile", response);

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

export function useUnmatchedPaymentRows({
  status = "",
  paymentSheetDate = "",
  fileName = "",
  page = 1,
  limit = 20,
} = {}) {
  return useQuery({
    queryKey: uploadQueryKeys.unmatchedRows({
      status,
      paymentSheetDate,
      fileName,
      page,
      limit,
    }),

    queryFn: () =>
      getUnmatchedPaymentRowsApi({
        status,
        paymentSheetDate,
        fileName,
        page,
        limit,
      }),

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
