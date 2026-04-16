import React from "react";
import { UploadCloud, FileText, X, Bolt, Activity, Upload } from "lucide-react";

export default function UploadFile({
  mode = "empty",
  title,
  description,
  selectedFile,
  isDragging,
  onBrowse,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  onCancel,
  onProcess,
  isProcessing = false,
  previewTitle = "File Analysis Preview",
  previewBadge = "Live Scan",
  showRates = true,
  analysis = {
    acquirers: [],
    currencies: [],
    merchantsList: [],
    rates: [],
    transactions: 0,
    merchants: 0,
    estimatedRevenue: 0,
  },
}) {
  if (mode === "filled") {
    return (
      <div className="mb-12 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <section className="space-y-8 lg:col-span-5">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">
              {title}
            </h2>
            <p className="text-on-surface-variant">{description}</p>
          </div>

          <div
            onClick={onBrowse}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? "border-primary/40 bg-surface-container"
                : "border-outline-variant/30 bg-surface-container-low hover:border-primary/30 hover:bg-surface-container"
            }`}
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <UploadCloud className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-on-surface">
                Drop your XLSX file here
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Max file size: 25MB
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 p-3 text-green-700">
                <FileText className="h-5 w-5" />
              </div>

              <div>
                <p className="font-bold text-on-surface">
                  {selectedFile?.name}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {selectedFile
                    ? `${(selectedFile.size / 1024 / 1024).toFixed(
                        2,
                      )} MB • Ready to process`
                    : "No file selected"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onRemove}
              className="text-on-surface-variant transition-colors hover:text-error"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onProcess}
              disabled={isProcessing}
              className="flex items-center gap-2 rounded-full bg-linear-to-br from-primary to-primary-container px-8 py-4 text-sm font-bold tracking-wide text-white transition"
            >
              <Upload className="h-4 w-4" />
              {isProcessing ? "UPLOADING..." : "UPLOAD DATA"}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-surface-container-high px-8 py-4 text-sm font-bold tracking-wide text-on-surface-variant transition-colors hover:bg-surface-variant"
            >
              CANCEL
            </button>
          </div>
        </section>

        <section className="space-y-6 rounded-xl bg-surface-container-low p-8 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-on-surface">
              {previewTitle}
            </h2>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              {previewBadge}
            </span>
          </div>

          <div
            className={`grid gap-4 ${
              showRates ? "grid-cols-2" : "grid-cols-2"
            }`}
          >
            <div className="col-span-2 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6 md:col-span-1">
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Acquirers Detected
              </p>
              <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                {analysis.acquirers.length > 0 ? (
                  analysis.acquirers.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-on-surface-variant">-</span>
                )}
              </div>
            </div>

            <div className="col-span-2 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6 md:col-span-1">
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Currencies Detected
              </p>
              <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                {analysis.currencies.length > 0 ? (
                  analysis.currencies.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-secondary"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-on-surface-variant">-</span>
                )}
              </div>
            </div>

            <div
              className={`rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6 ${showRates ? "col-span-2 md:col-span-1" : "col-span-2"}`}
            >
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Merchants Detected
              </p>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                {analysis.merchantsList.length > 0 ? (
                  analysis.merchantsList.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-on-surface-variant">-</span>
                )}
              </div>
            </div>

            {showRates && (
              <div className="col-span-2 rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6 md:col-span-1">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Rates Detected
                </p>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                  {analysis.rates.length > 0 ? (
                    analysis.rates.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-on-surface-variant">-</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col justify-between rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Transactions
              </p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-on-surface">
                {analysis.transactions}
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Merchant Count
              </p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-on-surface">
                {analysis.merchants}
              </p>
            </div>

            <div className="relative col-span-2 overflow-hidden rounded-lg bg-primary p-6">
              <div className="relative z-10">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-white/70">
                  Total Amount
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tracking-tight text-white">
                    {Number(analysis.estimatedRevenue || 0).toLocaleString(
                      "en-IN",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </span>
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 opacity-10">
                <Activity className="h-24 w-24 text-white" />
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-8">
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-on-surface">
          <UploadCloud className="h-5 w-5 text-primary" />
          {title}
        </h2>

        <div
          onClick={onBrowse}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`group flex min-h-90 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
            isDragging
              ? "border-primary/40 bg-surface-container"
              : "border-outline-variant/30 bg-surface-container-low hover:border-primary/30 hover:bg-surface-container"
          }`}
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 transition-transform duration-200 group-hover:scale-110">
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>

          <p className="mb-2 text-lg font-semibold text-on-surface">
            Drag and drop files here
          </p>

          <p className="mb-8 text-sm text-on-surface-variant">
            Supported formats: .xlsx, .csv (Max 50MB)
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBrowse();
            }}
            className="flex items-center gap-2 rounded-default bg-linear-to-br from-primary to-primary-container px-8 py-3 font-bold text-white transition"
          >
            Browse Files
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-8">
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-on-surface">
          <Activity className="h-5 w-5 text-primary" />
          Processing Status
        </h2>

        <div className="flex min-h-90 flex-col items-center justify-center rounded-lg border border-outline-variant/10 bg-surface-container-low p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-highest text-outline">
            <Activity className="h-8 w-8" />
          </div>

          <p className="text-lg font-medium italic text-on-surface-variant">
            No file uploaded yet
          </p>
          <p className="mt-2 max-w-xs text-sm text-on-surface-variant/60">
            Upload a file to see real-time extraction and validation results
            here.
          </p>
        </div>
      </section>
    </div>
  );
}
