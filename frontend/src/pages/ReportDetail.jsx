import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Landmark,
  ReceiptText,
} from "lucide-react";

import Accordion from "../component/UI/Accordion";
import Button from "../component/UI/Button";
import DataTable from "../component/UI/DataTable";
import EmptyState from "../component/UI/EmptyState";

import { formatDate, formatNumber } from "../utils/appUtils";

const transactionColumns = [
  { key: "period", label: "Period" },
  { key: "wiresheet", label: "Wiresheet", align: "right" },
  { key: "paid", label: "Paid", align: "right" },
  { key: "settlement", label: "Settlement", align: "right" },
  { key: "method", label: "Method" },
  { key: "paymentDate", label: "Payment Date" },
  { key: "status", label: "Status" },
];

function sumCurrencyValues(values = {}) {
  return Object.values(values).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
}

function CurrencyRows({ data = {} }) {
  const entries = Object.entries(data)
    .map(([currency, amount]) => ({
      currency,
      amount: Number(amount) || 0,
    }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

  if (entries.length === 0) {
    return <p className="text-sm text-on-surface-variant">No data available</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((item) => (
        <div
          key={item.currency}
          className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-low px-4 py-3"
        >
          <span className="text-sm font-semibold text-on-surface-variant">
            {item.currency}
          </span>

          <span className="whitespace-nowrap text-sm font-bold tabular-nums text-on-surface">
            {formatNumber(item.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ title, icon: Icon, data = {} }) {
  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-lowest p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-surface-container-low p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        <h3 className="text-sm font-bold text-on-surface">{title}</h3>
      </div>

      <CurrencyRows data={data} />
    </div>
  );
}

function MetricCard({ label, value, highlight = false }) {
  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-lowest p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </p>

      <p
        className={`mt-3 text-2xl font-extrabold tracking-tight ${
          highlight ? "text-primary" : "text-on-surface"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TransactionRow({ row }) {
  return (
    <tr className="table-row-hover">
      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface">
        {formatDate(row.receivedPeriod?.startDate)} →{" "}
        {formatDate(row.receivedPeriod?.endDate)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {row.receivedCurrency || "-"} {formatNumber(row.receivedAmount)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {row.paidCurrency || "-"} {formatNumber(row.paidAmount)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-primary">
        {row.settlementCurrency || "-"} {formatNumber(row.settlementAmount)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {row.paymentMethod || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {formatDate(row.paymentDate)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm">
        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold capitalize text-primary">
          {row.status || "-"}
        </span>
      </td>
    </tr>
  );
}

function MerchantAccordion({ merchant }) {
  const receivedTotal = sumCurrencyValues(merchant.received);
  const paidTotal = sumCurrencyValues(merchant.paidAgainstProcessing);
  const settlementTotal = sumCurrencyValues(merchant.settlement);

  return (
    <Accordion
      title={merchant.merchantName || "-"}
      subtitle={`MID: ${merchant.mid || "-"}`}
      icon={<Building2 className="h-5 w-5 text-primary" />}
      meta={
        <div className="grid grid-cols-2 gap-5 lg:flex lg:items-center lg:gap-10">
          <div className="text-left lg:text-right">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">
              Transactions
            </p>
            <p className="mt-1 text-sm font-bold text-on-surface">
              {merchant.transactions?.length || 0}
            </p>
          </div>

          <div className="text-left lg:text-right">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">
              Wiresheet
            </p>
            <p className="mt-1 text-sm font-bold text-on-surface">
              {formatNumber(receivedTotal)}
            </p>
          </div>

          <div className="text-left lg:text-right">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">
              Paid
            </p>
            <p className="mt-1 text-sm font-bold text-on-surface">
              {formatNumber(paidTotal)}
            </p>
          </div>

          <div className="text-left lg:text-right">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">
              Settlement
            </p>
            <p className="mt-1 text-sm font-bold text-primary">
              {formatNumber(settlementTotal)}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-8 pt-2">
        <div className="grid gap-5 xl:grid-cols-3">
          <SummaryCard
            title="Wiresheet Received"
            icon={CreditCard}
            data={merchant.received}
          />

          <SummaryCard
            title="Paid Against Processing"
            icon={Landmark}
            data={merchant.paidAgainstProcessing}
          />

          <SummaryCard
            title="Settlement Breakdown"
            icon={ReceiptText}
            data={merchant.settlement}
          />
        </div>

        <DataTable
          columns={transactionColumns}
          totalItems={merchant.transactions?.length || 0}
          isEmpty={!merchant.transactions?.length}
          emptyTitle="No transactions found"
          emptyDescription="No transaction data exists for this merchant."
          showFooter={false}
        >
          {(merchant.transactions || []).map((transaction, index) => (
            <TransactionRow
              key={`${merchant.mid}-${transaction.paymentDate}-${index}`}
              row={transaction}
            />
          ))}
        </DataTable>
      </div>
    </Accordion>
  );
}

export default function ReportDetail({ data, onBack }) {
  const pageRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      pageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    });
  }, []);

  if (!data) {
    return (
      <div className="bg-surface p-6">
        <EmptyState
          icon={Building2}
          title="No report selected"
          description="Please select a report from the reports dashboard."
        />
      </div>
    );
  }

  const merchantCount = data.merchants?.length || 0;

  const transactionCount = (data.merchants || []).reduce(
    (sum, merchant) => sum + (merchant.transactions?.length || 0),
    0,
  );

  const totalReceived = sumCurrencyValues(data.summary?.received);
  const totalPaid = sumCurrencyValues(data.summary?.paidAgainstProcessing);
  const totalSettlement = sumCurrencyValues(data.summary?.settlement);

  return (
    <div ref={pageRef} className="min-h-screen bg-surface p-4 md:p-6">
      <div className="space-y-6">
        <div className="rounded-2xl bg-surface-lowest px-5 py-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
                onClick={onBack}
                className=""
              />

              <div>
                <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-on-surface">
                  {data.bank} Detailed Report
                </h1>

                <p className="mt-1 text-sm text-on-surface-variant">
                  Financial settlement and processing overview for all
                  merchants.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 xl:grid-cols-5">
          <MetricCard
            label="Wiresheet Received"
            value={formatNumber(totalReceived)}
            highlight
          />
          <MetricCard label="Total Paid" value={formatNumber(totalPaid)} />
          <MetricCard
            label="Total Settlement"
            value={formatNumber(totalSettlement)}
          />
          <MetricCard label="Merchants" value={merchantCount} />
          <MetricCard label="Transactions" value={transactionCount} />
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-on-surface">
              Summary Overview
            </h2>

            <p className="mt-1 text-sm text-on-surface-variant">
              Consolidated totals across all merchants and currencies.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <SummaryCard
              title="All Wiresheet Received"
              icon={CreditCard}
              data={data.summary?.received}
            />

            <SummaryCard
              title="All Paid Against Processing"
              icon={Landmark}
              data={data.summary?.paidAgainstProcessing}
            />

            <SummaryCard
              title="All Settlement"
              icon={ReceiptText}
              data={data.summary?.settlement}
            />
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-on-surface">
              Merchant Reports
            </h2>

            <p className="mt-1 text-sm text-on-surface-variant">
              Merchant-level processing and settlement activity.
            </p>
          </div>

          {!data.merchants?.length ? (
            <EmptyState
              icon={Building2}
              title="No merchants available"
              description="No merchant data exists for this report."
            />
          ) : (
            <div className="space-y-4">
              {data.merchants.map((merchant, index) => (
                <MerchantAccordion
                  key={`${merchant.mid}-${merchant.merchantName}-${index}`}
                  merchant={merchant}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
