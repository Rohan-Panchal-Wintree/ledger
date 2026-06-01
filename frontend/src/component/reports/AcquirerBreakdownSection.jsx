import { ArrowRight, Landmark } from "lucide-react";

import Accordion from "../UI/Accordion";
import Button from "../UI/Button";
import EmptyState from "../UI/EmptyState";

import { formatNumber } from "../../utils/appUtils";

function getCurrencyEntries(values = {}) {
  return Object.entries(values)
    .map(([currency, amount]) => ({
      currency,
      amount: Number(amount) || 0,
    }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

function CurrencyPanel({ title, values = {}, tone = "primary" }) {
  const entries = getCurrencyEntries(values);
  const visibleEntries = entries.slice(0, 3);

  return (
    <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low/30 p-4">
      <div
        className={`mb-3 border-b border-outline-variant/10 pb-2 text-[10px] font-bold uppercase tracking-widest `}
      >
        {title}
      </div>

      <div className="space-y-2">
        {visibleEntries.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No data</p>
        ) : (
          visibleEntries.map((item, index) => (
            <div
              key={item.currency}
              className={`flex items-center justify-between gap-3`}
            >
              <span className="text-sm font-medium text-on-surface">
                {item.currency}
              </span>

              <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-on-surface">
                {formatNumber(item.amount)}
              </span>
            </div>
          ))
        )}

        {entries.length > 3 && (
          <div className="flex justify-center w-full bg-surface-container rounded-lg p-1">
            <p className=" text-xs font-semibold text-on-surface-variant">
              +{entries.length - 3} more currencies
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MerchantPreview({ merchants = [], acquirer }) {
  const previewMerchants = merchants.slice(0, 3);

  return (
    <div className="space-y-4">
      <h4 className="px-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
        Merchant Preview
      </h4>

      <div className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-low/20">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-low/40">
              <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Name
              </th>

              <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                MID
              </th>

              <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Txns
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-outline-variant/10">
            {previewMerchants.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-5 text-center text-sm text-on-surface-variant"
                >
                  No merchants available.
                </td>
              </tr>
            ) : (
              previewMerchants.map((merchant) => (
                <tr
                  key={`${acquirer}-${merchant.mid}-${merchant.merchantName}`}
                  className="group"
                >
                  <td className="px-4 py-2">
                    <span className="whitespace-nowrap text-sm font-medium text-on-surface">
                      {merchant.merchantName || "-"}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-right">
                    <span className="whitespace-nowrap text-xs tabular-nums text-on-surface-variant">
                      {merchant.mid || "-"}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-right">
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {merchant.transactions?.length || 0}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiStrip({ entry }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-outline-variant/5 bg-surface-container-low">
      <div className="flex-1 p-5 text-center">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Total Received
        </p>

        <p className="whitespace-nowrap text-lg font-semibold tabular-nums text-primary">
          {formatNumber(entry.totalReceived)}
        </p>
      </div>

      <div className="my-auto h-8 w-px bg-outline-variant/10" />

      <div className="flex-1 p-5 text-center">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Paid Against Processing
        </p>

        <p className="whitespace-nowrap text-lg font-semibold tabular-nums text-on-surface">
          {formatNumber(entry.totalPaidAgainstProcessing)}
        </p>
      </div>

      <div className="my-auto h-8 w-px bg-outline-variant/10" />

      <div className="flex-1 p-5 text-center">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Total Settlement
        </p>

        <p className="whitespace-nowrap text-lg font-semibold tabular-nums text-on-surface">
          {formatNumber(entry.totalSettlement)}
        </p>
      </div>
    </div>
  );
}

function AcquirerCard({ entry, onViewFullReport }) {
  return (
    <Accordion
      title={entry.acquirer}
      subtitle={`Period: ${entry.periodLabel}`}
      icon={<Landmark className="h-5 w-5 text-primary" />}
      meta={
        <div className="text-right">
          <p className="mb-0.5 text-[10px] uppercase tracking-widest text-on-surface-variant">
            Settled
          </p>

          <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-on-surface">
            {formatNumber(entry.totalSettlement)}
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        <KpiStrip entry={entry} />

        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="px-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Top Currency Distribution
            </h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <CurrencyPanel title="Received" values={entry.received} />
              <CurrencyPanel
                title="Paid"
                values={entry.paidAgainstProcessing}
              />
              <CurrencyPanel title="Settlement" values={entry.settlement} />
            </div>
          </div>

          <MerchantPreview
            merchants={entry.merchants}
            acquirer={entry.acquirer}
          />
        </div>

        <div className="flex justify-end border-t border-outline-variant/10 pt-4">
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRight className="h-4 w-4" />}
            onClick={() => onViewFullReport(entry.originalBankData)}
          >
            View full report
          </Button>
        </div>
      </div>
    </Accordion>
  );
}

export default function AcquirerBreakdownSection({
  receivedBreakdownByAcquirer = [],
  onViewFullReport,
}) {
  return (
    <section className="space-y-6">
      {receivedBreakdownByAcquirer.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-lowest p-6">
          <EmptyState
            icon={Landmark}
            title="No report data found"
            description="Select a payment date to view grouped acquirer summaries."
          />
        </div>
      ) : (
        receivedBreakdownByAcquirer.map((entry) => (
          <AcquirerCard
            key={entry.acquirer}
            entry={entry}
            onViewFullReport={onViewFullReport}
          />
        ))
      )}
    </section>
  );
}
