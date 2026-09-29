import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { merchantSettlementApi } from "../api";

/*
|--------------------------------------------------------------------------
| Query keys
|--------------------------------------------------------------------------
*/

export const merchantSettlementKeys = {
  all: ["merchant-settlement"],

  fees: () => [...merchantSettlementKeys.all, "fees"],

  feeList: (params = {}) => [...merchantSettlementKeys.fees(), "list", params],

  feeDetail: (id) => [...merchantSettlementKeys.fees(), "detail", id],

  feeChangeRequests: () => [
    ...merchantSettlementKeys.all,
    "fee-change-requests",
  ],

  feeChangeRequestList: (params = {}) => [
    ...merchantSettlementKeys.feeChangeRequests(),
    "list",
    params,
  ],

  transactions: () => [...merchantSettlementKeys.all, "transactions"],

  transactionList: (params = {}) => [
    ...merchantSettlementKeys.transactions(),
    "list",
    params,
  ],

  countries: () => [...merchantSettlementKeys.all, "countries"],

  countryList: (params = {}) => [
    ...merchantSettlementKeys.countries(),
    "list",
    params,
  ],

  countryDetail: (id) => [...merchantSettlementKeys.countries(), "detail", id],

  reports: () => [...merchantSettlementKeys.all, "reports"],

  reportList: (params = {}) => [
    ...merchantSettlementKeys.reports(),
    "list",
    params,
  ],

  reportDetail: (id) => [...merchantSettlementKeys.reports(), "detail", id],

  settlementBatches: () => [
    ...merchantSettlementKeys.all,
    "settlement-batches",
  ],

  settlementBatchList: (params = {}) => [
    ...merchantSettlementKeys.settlementBatches(),
    "list",
    params,
  ],
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== "all",
    ),
  );

/*
|--------------------------------------------------------------------------
| GET /fees
|--------------------------------------------------------------------------
*/

export const getMerchantSettlementFees = async (params = {}) => {
  const response = await merchantSettlementApi.get("/fees", {
    params: cleanParams(params),
  });

  return {
    items: response.data?.data || [],
    meta: response.data?.meta || {
      total: 0,
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 20,
      totalPages: 0,
    },
  };
};

export const useMerchantSettlementFees = (params = {}) =>
  useQuery({
    queryKey: merchantSettlementKeys.feeList(params),
    queryFn: () => getMerchantSettlementFees(params),
    placeholderData: (previousData) => previousData,
  });

/*
|--------------------------------------------------------------------------
| GET /fees/:id
|--------------------------------------------------------------------------
*/

export const getMerchantSettlementFee = async (id) => {
  const response = await merchantSettlementApi.get(`/fees/${id}`);

  return response.data?.data;
};

export const useMerchantSettlementFee = (id, options = {}) =>
  useQuery({
    queryKey: merchantSettlementKeys.feeDetail(id),
    queryFn: () => getMerchantSettlementFee(id),
    enabled: Boolean(id),
    ...options,
  });

/*
|--------------------------------------------------------------------------
| POST /fees
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This does NOT immediately create MerchantFeeConfig.
| Backend creates a PENDING_APPROVAL change request.
|--------------------------------------------------------------------------
*/

export const createMerchantSettlementFee = async (payload) => {
  const response = await merchantSettlementApi.post("/fees", payload);

  return response.data;
};

export const useCreateMerchantSettlementFee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMerchantSettlementFee,

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.fees(),
        }),
        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.feeChangeRequests(),
        }),
      ]);
    },
  });
};

/*
|--------------------------------------------------------------------------
| PUT /fees/:id
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This does NOT immediately modify MerchantFeeConfig.
| Backend creates a PENDING_APPROVAL change request.
|--------------------------------------------------------------------------
*/

export const updateMerchantSettlementFee = async ({ id, payload }) => {
  const response = await merchantSettlementApi.put(`/fees/${id}`, payload);

  return response.data;
};

export const useUpdateMerchantSettlementFee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMerchantSettlementFee,

    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.fees(),
        }),
        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.feeDetail(variables.id),
        }),
        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.feeChangeRequests(),
        }),
      ]);
    },
  });
};

/*
|--------------------------------------------------------------------------
| DELETE /fees/:id
|--------------------------------------------------------------------------
|
| Current backend behaviour:
| This immediately soft-deactivates the fee by setting status = inactive.
|--------------------------------------------------------------------------
*/

export const deleteMerchantSettlementFee = async (id) => {
  const response = await merchantSettlementApi.delete(`/fees/${id}`);

  return response.data;
};

export const useDeleteMerchantSettlementFee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMerchantSettlementFee,

    onSuccess: async (_data, id) => {
      queryClient.removeQueries({
        queryKey: merchantSettlementKeys.feeDetail(id),
      });

      await queryClient.invalidateQueries({
        queryKey: merchantSettlementKeys.fees(),
      });
    },
  });
};

/*
|--------------------------------------------------------------------------
| PATCH /fees/:id/activate
|--------------------------------------------------------------------------
|
| Current backend behaviour:
| This immediately activates the fee by setting status = active.
|--------------------------------------------------------------------------
*/

export const activateMerchantSettlementFee = async (id) => {
  const response = await merchantSettlementApi.patch(`/fees/${id}/activate`);

  return response.data;
};

export const useActivateMerchantSettlementFee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateMerchantSettlementFee,

    onSuccess: async (_data, id) => {
      queryClient.removeQueries({
        queryKey: merchantSettlementKeys.feeDetail(id),
      });

      await queryClient.invalidateQueries({
        queryKey: merchantSettlementKeys.fees(),
      });
    },
  });
};

/*
|--------------------------------------------------------------------------
| GET /fees/change-requests
|--------------------------------------------------------------------------
|
| Current backend behaviour:
| This gets all the rate requests and displays on the frontend.
|--------------------------------------------------------------------------
*/

export const getMerchantSettlementFeeChangeRequests = async (params = {}) => {
  const response = await merchantSettlementApi.get("/fees/change-requests", {
    params: cleanParams(params),
  });

  return response.data?.data || [];
};

export const useMerchantSettlementFeeChangeRequests = (
  params = {},
  options = {},
) =>
  useQuery({
    queryKey: merchantSettlementKeys.feeChangeRequestList(params),
    queryFn: () => getMerchantSettlementFeeChangeRequests(params),
    ...options,
  });

/*
|--------------------------------------------------------------------------
| POST /fees/change-requests/${id}/approve
|--------------------------------------------------------------------------
|
| Current backend behaviour:
| This approves the request to update the rates.
|--------------------------------------------------------------------------
*/

export const approveMerchantSettlementFeeChangeRequest = async ({
  id,
  checkerComment = "",
}) => {
  const response = await merchantSettlementApi.post(
    `/fees/change-requests/${id}/approve`,
    {
      checkerComment,
    },
  );

  return response.data;
};

export const useApproveMerchantSettlementFeeChangeRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveMerchantSettlementFeeChangeRequest,

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.feeChangeRequests(),
        }),

        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.fees(),
        }),
      ]);
    },
  });
};

/*
|--------------------------------------------------------------------------
| POST /fees/change-requests/${id}/reject
|--------------------------------------------------------------------------
|
| Current backend behaviour:
| This rejects the request to update the rates.
|--------------------------------------------------------------------------
*/

export const rejectMerchantSettlementFeeChangeRequest = async ({
  id,
  checkerComment,
}) => {
  const response = await merchantSettlementApi.post(
    `/fees/change-requests/${id}/reject`,
    {
      checkerComment,
    },
  );

  return response.data;
};

export const useRejectMerchantSettlementFeeChangeRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectMerchantSettlementFeeChangeRequest,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: merchantSettlementKeys.feeChangeRequests(),
      });
    },
  });
};

/*
|--------------------------------------------------------------------------
| GET /transactions
|--------------------------------------------------------------------------
*/

export const getMerchantSettlementTransactions = async (params = {}) => {
  const response = await merchantSettlementApi.get("/transactions", {
    params: cleanParams(params),
  });

  return {
    items: response.data?.data || [],
    meta: response.data?.meta || {
      total: 0,
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 20,
      totalPages: 0,
    },
  };
};

export const useMerchantSettlementTransactions = (params = {}) =>
  useQuery({
    queryKey: merchantSettlementKeys.transactionList(params),
    queryFn: () => getMerchantSettlementTransactions(params),
    placeholderData: (previousData) => previousData,
  });

/*
|--------------------------------------------------------------------------
| GET /countries
|--------------------------------------------------------------------------
*/

export const getMerchantSettlementCountries = async (params = {}) => {
  const cleanedParams = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );

  const response = await merchantSettlementApi.get("/countries", {
    params: cleanedParams,
  });

  return {
    items: response.data?.data || [],

    meta: response.data?.meta || {
      total: 0,
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 100,
      totalPages: 0,
    },
  };
};

export const useMerchantSettlementCountries = (params = {}) =>
  useQuery({
    queryKey: merchantSettlementKeys.countryList(params),
    queryFn: () => getMerchantSettlementCountries(params),
    placeholderData: (previousData) => previousData,
  });

/*
|--------------------------------------------------------------------------
| POST /countries
|--------------------------------------------------------------------------
*/

export const createMerchantSettlementCountry = async (payload) => {
  const response = await merchantSettlementApi.post("/countries", payload);

  return response.data;
};

export const useCreateMerchantSettlementCountry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMerchantSettlementCountry,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: merchantSettlementKeys.countries(),
      });
    },
  });
};

/*
|--------------------------------------------------------------------------
| PUT /countries/:id
|--------------------------------------------------------------------------
*/

export const updateMerchantSettlementCountry = async ({ id, payload }) => {
  const response = await merchantSettlementApi.put(`/countries/${id}`, payload);

  return response.data;
};

export const useUpdateMerchantSettlementCountry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMerchantSettlementCountry,

    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.countries(),
        }),

        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.countryDetail(variables.id),
        }),
      ]);
    },
  });
};

/*
|--------------------------------------------------------------------------
| DELETE /countries/:id
|--------------------------------------------------------------------------
*/

export const deleteMerchantSettlementCountry = async (id) => {
  const response = await merchantSettlementApi.delete(`/countries/${id}`);

  return response.data;
};

export const useDeleteMerchantSettlementCountry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMerchantSettlementCountry,

    onSuccess: async (_data, id) => {
      queryClient.removeQueries({
        queryKey: merchantSettlementKeys.countryDetail(id),
      });

      await queryClient.invalidateQueries({
        queryKey: merchantSettlementKeys.countries(),
      });
    },
  });
};

/*
|--------------------------------------------------------------------------
| GET /reports
|--------------------------------------------------------------------------
*/

export const getMerchantSettlementReports = async (params = {}) => {
  const response = await merchantSettlementApi.get("/reports", {
    params: cleanParams(params),
  });

  return {
    items: response.data?.data || [],

    meta: response.data?.meta || {
      total: 0,
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 50,
      totalPages: 0,
    },
  };
};

export const useMerchantSettlementReports = (params = {}) =>
  useQuery({
    queryKey: merchantSettlementKeys.reportList(params),

    queryFn: () => getMerchantSettlementReports(params),

    placeholderData: (previousData) => previousData,
  });

/*
|--------------------------------------------------------------------------
| GET /reports/:id
|--------------------------------------------------------------------------
*/

export const getMerchantSettlementReport = async (id) => {
  const response = await merchantSettlementApi.get(`/reports/${id}`);

  return response.data?.data;
};

export const useMerchantSettlementReport = (id, options = {}) =>
  useQuery({
    queryKey: merchantSettlementKeys.reportDetail(id),

    queryFn: () => getMerchantSettlementReport(id),

    enabled: Boolean(id),

    ...options,
  });

/*
|--------------------------------------------------------------------------
| POST /reports/:id/send-email
|--------------------------------------------------------------------------
*/

export const sendMerchantSettlementReportEmail = async (id) => {
  const response = await merchantSettlementApi.post(
    `/reports/${id}/send-email`,
  );

  return response.data;
};

export const useSendMerchantSettlementReportEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMerchantSettlementReportEmail,

    onSuccess: async (_data, id) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.reports(),
        }),

        queryClient.invalidateQueries({
          queryKey: merchantSettlementKeys.reportDetail(id),
        }),
      ]);
    },
  });
};

/*
|--------------------------------------------------------------------------
| POST /settlement-batches/:batchId/send-all-emails
|--------------------------------------------------------------------------
*/

export const sendAllSettlementEmailsForBatch = async (batchId) => {
  const response = await merchantSettlementApi.post(
    `/settlement-batches/${batchId}/send-all-emails`,
  );

  return response.data;
};

export const useSendAllSettlementEmailsForBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendAllSettlementEmailsForBatch,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: merchantSettlementKeys.reports(),
      });
    },
  });
};

/*
|--------------------------------------------------------------------------
| GET /reports/:id/download-pdf
|--------------------------------------------------------------------------
*/

export const downloadMerchantSettlementReportPdf = async (id) => {
  return merchantSettlementApi.get(`/reports/${id}/download-pdf`, {
    responseType: "blob",
  });
};

/*
|--------------------------------------------------------------------------
| GET /reports/:id/download-excel
|--------------------------------------------------------------------------
*/

export const downloadMerchantSettlementReportExcel = async (id) => {
  return merchantSettlementApi.get(`/reports/${id}/download-excel`, {
    responseType: "blob",
  });
};

/*
|--------------------------------------------------------------------------
| GET /settlement-batches
|--------------------------------------------------------------------------
*/

export const getMerchantSettlementBatches = async (params = {}) => {
  const response = await merchantSettlementApi.get("/settlement-batches", {
    params: cleanParams(params),
  });

  return {
    items: response.data?.data || [],

    meta: response.data?.meta || {
      total: 0,
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 50,
      totalPages: 0,
    },
  };
};

export const useMerchantSettlementBatches = (params = {}) =>
  useQuery({
    queryKey: merchantSettlementKeys.settlementBatchList(params),

    queryFn: () => getMerchantSettlementBatches(params),

    placeholderData: (previousData) => previousData,
  });
