import { useRef, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../UI/Modal";
import Button from "../UI/Button";
import Spinner from "../UI/Spinner";
import {
  downloadMerchantSettlementDocument,
  useMerchantSettlementAcquirers,
} from "../../queries/merchantSettlementQueries";
import { formatNumber, getErrorMessage } from "../../utils/appUtils";
import {
  buildAcquirerConversionPreview,
  changeAcquirerTarget,
  getConversionRateGroups,
  getEffectiveRate,
  getRateDraft,
  setIndividualRate,
  setSharedRate,
  toggleSharedRate,
} from "../../utils/acquirerSettlement";

const inputClass = "min-w-0 flex-1 rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-right font-semibold text-on-surface outline-none focus:border-primary disabled:opacity-60";

export default function MerchantSettlementConversionModal({ report, onClose, downloadFile }) {
  const id = report._id || report.id;
  const query = useMerchantSettlementAcquirers(id);
  const [settings, setSettings] = useState({ currencies: {}, drafts: {} });
  const [activeAudience, setActiveAudience] = useState("internal");
  const [merchantCurrency, setMerchantCurrency] = useState("EUR");
  const [merchantDrafts, setMerchantDrafts] = useState({});
  const [downloadingAudience, setDownloadingAudience] = useState(null);
  const downloading = useRef(false);
  const isDownloading = Boolean(downloadingAudience);
  const acquirers = query.data?.acquirers || [];
  const preview = buildAcquirerConversionPreview(acquirers, settings.drafts, settings.currencies);
  const rateGroups = getConversionRateGroups(acquirers, settings.currencies);
  const loading = query.isPending || query.isFetching;
  const merchantPreview = buildAcquirerConversionPreview([{
    acquirer: "MERCHANT",
    currencies: Object.entries(report.currencySummary || {}).map(([currency, row]) => ({ currency, netPayable: row.netSettlement })),
  }], merchantDrafts, merchantCurrency);
  const canDownloadInternal = !loading && !query.isError && preview.valid;
  const canDownload = activeAudience === "internal" ? canDownloadInternal : merchantPreview.valid;

  const updateDrafts = (update) => setSettings((previous) => ({ ...previous, drafts: update(previous.drafts) }));
  const close = () => {
    if (!downloading.current) onClose();
  };
  const download = async (audience) => {
    if (!canDownload || downloading.current) return;
    downloading.current = true;
    setDownloadingAudience(audience);
    try {
      const payload = audience === "internal" ? {
        settlementCurrenciesByAcquirer: preview.settlementCurrenciesByAcquirer,
        ratesByAcquirer: preview.ratesByAcquirer,
        snapshot: query.data.snapshot,
      } : {
        settlementCurrency: merchantCurrency,
        rates: merchantPreview.ratesByAcquirer.MERCHANT,
      };
      const response = await downloadMerchantSettlementDocument(id, payload, audience);
      const member = String(report.memberId || "merchant").replace(/[^A-Za-z0-9_-]/g, "-");
      const suffix = audience === "internal" ? "Acquirer-Settlement" : "Merchant-Settlement";
      downloadFile(response, `MID${member}-${suffix}.pdf`);
      toast.success(audience === "internal" ? "Acquirer PDF downloaded." : "Merchant PDF downloaded.");
      // Keep the dialog and rates available for downloading the other document.
    } catch (error) {
      let message = getErrorMessage(error, "Unable to download settlement PDF.");
      if (error?.response?.data instanceof Blob) {
        message = "Unable to download settlement PDF.";
        try {
          const body = JSON.parse(await error.response.data.text());
          message = body.message || message;
        } catch { /* Keep fallback for non-JSON responses. */ }
      }
      toast.error(message);
    } finally {
      downloading.current = false;
      setDownloadingAudience(null);
    }
  };

  return (
    <Modal
      open
      title="Settlement Conversion"
      description={`${report.merchantName} | MID ${report.memberId}`}
      size="lg"
      onClose={close}
      footer={<>
        <Button variant="secondary" disabled={isDownloading} onClick={close}>Close</Button>
        <Button loading={isDownloading} disabled={!canDownload || isDownloading} onClick={() => download(activeAudience)}>
          {activeAudience === "internal" ? "Download Acquirer PDF" : "Download Merchant PDF"}
        </Button>
      </>}
    >
      <div className="space-y-5">
        <div role="group" aria-label="Settlement document" className="flex flex-wrap gap-2">
          <Button variant="secondary" active={activeAudience === "internal"} disabled={isDownloading} onClick={() => setActiveAudience("internal")}>Acquirer PDF</Button>
          <Button variant="secondary" active={activeAudience === "merchant"} disabled={isDownloading} onClick={() => setActiveAudience("merchant")}>Merchant PDF</Button>
        </div>
        {activeAudience === "merchant" ? <div className="space-y-5">
          <p className="text-sm text-on-surface-variant">Use the original merchant-wide amounts and conversion for the merchant PDF.</p>
          <label className="block space-y-2 text-sm font-semibold text-on-surface">
            <span>Settlement currency</span>
            <select value={merchantCurrency} aria-label="Merchant settlement currency" disabled={isDownloading}
              onChange={(event) => setMerchantCurrency(event.target.value)}
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-2">
              <option value="EUR">EUR</option><option value="USDT">USDT</option>
            </select>
          </label>
          {merchantPreview.groups[0].rows.map((row) => (
            <div key={row.currency} className="space-y-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <p className="text-sm text-on-surface-variant">Net payable: <strong className="text-on-surface">{formatNumber(row.netPayable)} {row.currency}</strong></p>
              <label className="flex items-center gap-2 text-sm">
                <span className="shrink-0">1 {row.currency} =</span>
                <input type="number" step="any" min="0" aria-label={`Merchant ${row.currency} conversion rate`}
                  value={getEffectiveRate(merchantDrafts, merchantCurrency, "MERCHANT", row.currency)}
                  disabled={isDownloading || row.currency === merchantCurrency}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMerchantDrafts((previous) => setIndividualRate(previous, merchantCurrency, "MERCHANT", row.currency, value));
                  }} className={inputClass} />
                <span>{merchantCurrency}</span>
              </label>
              <p className="text-sm text-on-surface-variant">Converted payable: {row.valid
                ? <strong className="text-on-surface">{formatNumber(row.convertedCents / 100)} {merchantCurrency}</strong>
                : <span className="text-error">Enter a valid positive rate</span>}</p>
            </div>
          ))}
          <div className="rounded-xl bg-surface-container p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Final payable</p>
            <p className="mt-1 text-xl font-bold text-on-surface">{merchantPreview.valid
              ? `${formatNumber(merchantPreview.totalCents / 100)} ${merchantCurrency}` : "Complete all conversion rates"}</p>
          </div>
        </div> : <>
        <p className="text-sm text-on-surface-variant">
          Choose a settlement currency for each acquirer. The PDF includes a final total for each settlement currency. Acquirers with a zero final payable are omitted.
          The merchant PDF keeps its own original amounts and conversion in the separate Merchant PDF tab.
        </p>
        {loading ? (
          <div className="flex justify-center py-8" role="status" aria-label="Loading acquirer settlements"><Spinner type="md" /></div>
        ) : query.isError ? (
          <div role="alert" className="space-y-3 text-sm text-error">
            <p>{getErrorMessage(query.error, "Unable to load acquirer settlements.")}</p>
            <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : <>
          {rateGroups.filter((group) => group.owners.length > 1 ||
            getRateDraft(settings.drafts, group.settlementCurrency).sharedEnabled[group.currency])
            .map(({ currency, settlementCurrency, owners }) => {
              const draft = getRateDraft(settings.drafts, settlementCurrency);
              return (
                <div key={`${currency}-${settlementCurrency}`} className="space-y-3 rounded-xl bg-surface-container p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={Boolean(draft.sharedEnabled[currency])} disabled={isDownloading}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        updateDrafts((previous) => toggleSharedRate(previous, settlementCurrency, currency, owners, checked));
                      }} />
                    Same {currency} to {settlementCurrency} rate for all matching acquirers
                  </label>
                  {draft.sharedEnabled[currency] && <label className="flex items-center gap-2 text-sm">
                    <span className="shrink-0">1 {currency} =</span>
                    <input type="number" step="any" min="0" aria-label={`Shared ${currency} to ${settlementCurrency} conversion rate`}
                      value={draft.sharedValues[currency] ?? ""} disabled={isDownloading}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateDrafts((previous) => setSharedRate(previous, settlementCurrency, currency, value));
                      }} className={inputClass} />
                    <span>{settlementCurrency}</span>
                  </label>}
                </div>
              );
            })}
          {preview.groups.map((group) => {
            const settlementCurrency = group.settlementCurrency;
            const draft = getRateDraft(settings.drafts, settlementCurrency);
            return (
              <div key={group.acquirer} className="space-y-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-bold text-on-surface">{group.acquirer}</h4>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <span>Settlement currency</span>
                    <select value={settlementCurrency} aria-label={`${group.acquirer} settlement currency`}
                      disabled={isDownloading} className="rounded-xl border border-outline-variant/20 bg-surface px-3 py-2"
                      onChange={(event) => {
                        const target = event.target.value;
                        setSettings((previous) => changeAcquirerTarget(previous, acquirers, group.acquirer, target));
                      }}>
                      <option value="EUR">EUR</option><option value="USDT">USDT</option>
                    </select>
                  </label>
                </div>
                {group.rows.map((row) => (
                  <div key={row.currency} className="space-y-2 border-b border-outline-variant/10 pb-3">
                    <p className="text-sm text-on-surface-variant">Net payable: <strong className="text-on-surface">{formatNumber(row.netPayable)} {row.currency}</strong></p>
                    {row.currency === settlementCurrency ? <p className="text-sm">1 {row.currency} = 1 {settlementCurrency}</p>
                      : draft.sharedEnabled[row.currency] ? <p className="text-sm">Using shared {row.currency} to {settlementCurrency} rate: {getEffectiveRate(settings.drafts, settlementCurrency, group.acquirer, row.currency) || "?"}</p>
                        : <label className="flex items-center gap-2 text-sm">
                          <span className="shrink-0">1 {row.currency} =</span>
                          <input type="number" step="any" min="0" aria-label={`${group.acquirer} ${row.currency} to ${settlementCurrency} conversion rate`}
                            value={getEffectiveRate(settings.drafts, settlementCurrency, group.acquirer, row.currency)} disabled={isDownloading}
                            onChange={(event) => {
                              const value = event.target.value;
                              updateDrafts((previous) => setIndividualRate(previous, settlementCurrency, group.acquirer, row.currency, value));
                            }} className={inputClass} />
                          <span>{settlementCurrency}</span>
                        </label>}
                    <p className="text-sm text-on-surface-variant">Converted payable: {row.valid
                      ? <strong className="text-on-surface">{formatNumber(row.convertedCents / 100)} {settlementCurrency}</strong>
                      : <span className="text-error">Enter a valid positive rate</span>}</p>
                  </div>
                ))}
                <p className="text-sm font-bold">Acquirer payable: {group.valid ? `${formatNumber(group.totalCents / 100)} ${settlementCurrency}` : "Complete this acquirer's rates"}</p>
              </div>
            );
          })}
          {!acquirers.length && <p className="text-sm">No acquirer settlements found for this report.</p>}
        </>}
        <div className="rounded-xl bg-surface-container p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Final payable by settlement currency</p>
          {canDownload ? preview.totalsByCurrency.map((row) => (
            <p key={row.currency} className="mt-1 text-xl font-bold text-on-surface">{formatNumber(row.totalCents / 100)} {row.currency}</p>
          )) : <p className="mt-1 font-semibold">Complete all conversion rates</p>}
        </div>
        </>}
      </div>
    </Modal>
  );
}
