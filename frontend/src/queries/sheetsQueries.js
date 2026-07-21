import { useQuery } from "@tanstack/react-query";

import { sheetsApi } from "../api";

export const sheetsQueryKeys = {
  all: ["sheets"],

  wiresheets: {
    all: () => [...sheetsQueryKeys.all, "wiresheets"],
    list: (params = {}) => [...sheetsQueryKeys.wiresheets.all(), params],
  },

  paymentSheets: {
    all: () => [...sheetsQueryKeys.all, "payment-sheets"],
    list: (params = {}) => [...sheetsQueryKeys.paymentSheets.all(), params],
  },
};

function extractResponsePayload(response) {
  return {
    data: response?.data?.data ?? [],
    meta: response?.data?.meta ?? {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    },
  };
}

// function buildQueryParams({ page = 1, limit = 20, fromDate, toDate } = {}) {
//   const params = {
//     page,
//     limit,
//   };

//   if (fromDate) {
//     params.fromDate = fromDate;
//   }

//   if (toDate) {
//     params.toDate = toDate;
//   }

//   return params;
// }

function buildQueryParams({
  page = 1,
  limit = 20,
  fromDate,
  toDate,
  search,
} = {}) {
  const params = {
    page,
    limit,
  };

  if (fromDate) {
    params.fromDate = fromDate;
  }

  if (toDate) {
    params.toDate = toDate;
  }

  const normalizedSearch = String(search || "").trim();

  if (normalizedSearch) {
    params.search = normalizedSearch;
  }

  return params;
}

function getDownloadFileNameFromUrl(url, fallback = "download.xlsx") {
  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.split("/").pop();

    return decodeURIComponent(fileName || fallback);
  } catch {
    return fallback;
  }
}

function triggerBrowserDownload(url, fileName) {
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener noreferrer";
  anchor.target = "_blank";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function getWiresheetsApi(filters = {}) {
  const response = await sheetsApi.get("/wiresheets", {
    params: buildQueryParams(filters),
  });

  return extractResponsePayload(response);
}

async function getPaymentSheetsApi(filters = {}) {
  const response = await sheetsApi.get("/payment-sheets", {
    params: buildQueryParams(filters),
  });

  return extractResponsePayload(response);
}

export async function downloadSheetUpload(id, fileName) {
  if (!id) {
    throw new Error("Missing upload id.");
  }

  const response = await sheetsApi.post(`/${id}/download`);

  const downloadUrl = response?.data?.data?.downloadUrl;

  if (!downloadUrl) {
    throw new Error("Download link not available.");
  }

  triggerBrowserDownload(
    downloadUrl,
    fileName || getDownloadFileNameFromUrl(downloadUrl),
  );

  return downloadUrl;
}

export function useWiresheets(filters = {}) {
  return useQuery({
    queryKey: sheetsQueryKeys.wiresheets.list(filters),
    queryFn: () => getWiresheetsApi(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function usePaymentSheets(filters = {}) {
  return useQuery({
    queryKey: sheetsQueryKeys.paymentSheets.list(filters),
    queryFn: () => getPaymentSheetsApi(filters),
    placeholderData: (previousData) => previousData,
  });
}
