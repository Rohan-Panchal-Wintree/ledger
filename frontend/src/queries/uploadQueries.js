import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentApi, wiresheetApi, invalidApi } from "../api";
import { dashboardQueryKeys } from "./dashboardQueries";

export const uploadQueryKeys = {
  all: ["uploads"],
  unmatchedSummary: () => [...uploadQueryKeys.all, "unmatched-summary"],
  invalidRows: ({ status, paymentSheetDate, fileName, page, limit } = {}) => [
    ...uploadQueryKeys.all,
    "invalid-rows",
    { status, paymentSheetDate, fileName, page, limit },
  ],
};

// Fetch unmatched payment summary
async function getUnmatchedPaymentsSummaryApi() {
  const response = await paymentApi.get("/unmatched-summary");

  return (
    response.data?.data || {
      pendingCount: 0,
      manualReviewCount: 0,
      recentRows: [],
    }
  );
}

// Upload wiresheet and payment sheet files
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

    result.wire = wireResponse.data?.data || wireResponse.data;
  }

  if (paymentFiles.length > 0) {
    const paymentFormData = new FormData();

    paymentFiles.forEach((file) => {
      paymentFormData.append(
        paymentFiles.length === 1 ? "file" : "files",
        file,
      );
    });

    if (batchId) paymentFormData.append("batchId", batchId);
    if (paymentDate) paymentFormData.append("paymentDate", paymentDate);

    const paymentResponse = await paymentApi.post(
      "/upload-paymentsheet",
      paymentFormData,
    );

    result.payments = paymentResponse.data?.data || paymentResponse.data;
  }

  return result;
}

// Reconcile unmatched payment rows
async function reconcileUnmatchedPaymentRowsApi({ batchId } = {}) {
  const response = await paymentApi.post(
    "/reconcile-unmatched",
    batchId ? { batchId } : {},
  );

  return response.data?.data || response.data;
}

// Fetch invalid payment rows
async function getInvalidPaymentRowsApi({
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

  if (status) params.status = status;
  if (paymentSheetDate) params.paymentSheetDate = paymentSheetDate;
  if (fileName) params.fileName = fileName;

  const response = await invalidApi.get("/", {
    params,
  });

  return {
    items: response.data?.data || [],
    meta: response.data?.meta || {
      total: 0,
      page,
      limit,
      totalPages: 1,
    },
  };
}

// Save fixed data for invalid row
async function updateInvalidPaymentRowApi({ id, payload }) {
  const response = await invalidApi.put(`/${id}`, payload);
  return response.data?.data || response.data;
}

// Reconcile fixed invalid row
async function reconcileInvalidPaymentRowApi(id) {
  const response = await invalidApi.post(`/${id}/reconcile`);
  console.log("reconciled response for the invalid rows", response?.data);
  return response.data?.data || response.data;
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
      queryClient.invalidateQueries({ queryKey: uploadQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
    },
  });
}

export function useReconcileUnmatchedPaymentRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconcileUnmatchedPaymentRowsApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uploadQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
    },
  });
}

export function useInvalidPaymentRows({
  status = "",
  paymentSheetDate = "",
  fileName = "",
  page = 1,
  limit = 20,
} = {}) {
  return useQuery({
    queryKey: uploadQueryKeys.invalidRows({
      status,
      paymentSheetDate,
      fileName,
      page,
      limit,
    }),
    queryFn: () =>
      getInvalidPaymentRowsApi({
        status,
        paymentSheetDate,
        fileName,
        page,
        limit,
      }),
    placeholderData: (previousData) => previousData,
  });
}

export function useUpdateInvalidPaymentRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateInvalidPaymentRowApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uploadQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
    },
  });
}

export function useReconcileInvalidPaymentRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconcileInvalidPaymentRowApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uploadQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
    },
  });
}
