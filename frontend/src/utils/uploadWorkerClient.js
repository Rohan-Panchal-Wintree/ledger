let uploadParserWorker = null;
let requestId = 0;
const pendingRequests = new Map();

function getWorker() {
  if (!uploadParserWorker) {
    uploadParserWorker = new Worker(
      new URL("../workers/uploadParser.worker.js", import.meta.url),
      {
        type: "module",
      },
    );

    uploadParserWorker.onmessage = (event) => {
      const { id, success, data, error } = event.data;
      const request = pendingRequests.get(id);

      if (!request) return;

      pendingRequests.delete(id);

      if (success) {
        request.resolve(data);
      } else {
        request.reject(new Error(error));
      }
    };

    uploadParserWorker.onerror = (error) => {
      pendingRequests.forEach((request) => {
        request.reject(
          new Error(error?.message || "Upload parser worker failed."),
        );
      });

      pendingRequests.clear();
      uploadParserWorker?.terminate();
      uploadParserWorker = null;
    };
  }

  return uploadParserWorker;
}

export async function parseUploadFileInWorker(file, tab) {
  const worker = getWorker();
  const id = `${Date.now()}-${requestId}`;
  requestId += 1;

  const arrayBuffer = await file.arrayBuffer();

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve,
      reject,
    });

    worker.postMessage(
      {
        id,
        tab,
        fileName: file.name,
        arrayBuffer,
      },
      [arrayBuffer],
    );
  });
}

export function terminateUploadParserWorker() {
  if (uploadParserWorker) {
    uploadParserWorker.terminate();
    uploadParserWorker = null;
  }

  pendingRequests.clear();
}
