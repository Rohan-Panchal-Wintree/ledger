import {
  ArrowRightLeft,
  FileSpreadsheet,
  Landmark,
  Wallet,
} from "lucide-react";

import Accordion from "../UI/Accordion";
import DataTable from "../UI/DataTable";
import StatCard from "../UI/StatCard";

import { formatDate, formatNumber } from "../../utils/appUtils";

const matchedTransactionColumns = [
  { key: "merchant", label: "Merchant" },
  { key: "mid", label: "MID" },
  { key: "processing", label: "Processing", align: "right" },
  { key: "payable", label: "Payable", align: "right" },
  { key: "paid", label: "Paid", align: "right" },
  { key: "balance", label: "Balance", align: "right" },
  { key: "paymentAmount", label: "Payment Amount", align: "right" },
  { key: "settlement", label: "Settlement", align: "right" },
  { key: "paymentDate", label: "Payment Date" },
];

function MatchedTransactionRows({ transactions }) {
  return transactions.map((transaction, index) => (
    <tr
      key={transaction.paymentId || transaction.wiresheetTransactionId || index}
      className="table-row-hover"
    >
      <td className="px-8 py-4">
        <p className="min-w-32 text-sm font-semibold text-on-surface">
          {transaction.merchantName || "-"}
        </p>
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {transaction.mid || "-"}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm text-on-surface-variant">
        {transaction.processingCurrency || "-"}{" "}
        {formatNumber(transaction.processingAmount)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm text-on-surface-variant">
        {formatNumber(transaction.payable)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm text-on-surface-variant">
        {formatNumber(transaction.paid)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-semibold text-on-surface">
        {formatNumber(transaction.balance)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-on-surface">
        {formatNumber(transaction.paymentAmount)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-right text-sm font-bold text-primary">
        {transaction.settlementCurrency || "-"}{" "}
        {formatNumber(transaction.settlementAmount)}
      </td>

      <td className="whitespace-nowrap px-8 py-4 text-sm text-on-surface-variant">
        {formatDate(transaction.paymentDate)}
      </td>
    </tr>
  ));
}

export default function PaymentSheetMatchedWiresheetsContent({ data }) {
  if (!data) return null;

  const summary = data.summary || {};
  const paymentSheet = data.paymentSheet || {};
  const wiresheets = data.wiresheets || [];
  const transactions = data.transactions || [];

  return (
    <div className="space-y-6">
      {/* Payment sheet details */}
      <div className="rounded-lg bg-surface-container-low px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Payment Sheet
            </p>

            <h3 className="mt-2 break-all text-lg font-bold text-on-surface">
              {paymentSheet.fileName || "-"}
            </h3>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">
                Payment Date
              </p>

              <p className="mt-1 text-sm font-semibold text-on-surface">
                {formatDate(paymentSheet.paymentDate)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-on-surface-variant">
                Uploaded At
              </p>

              <p className="mt-1 text-sm font-semibold text-on-surface">
                {formatDate(paymentSheet.uploadedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Matched Payments"
          value={summary.totalMatchedPayments ?? 0}
          helper="Total matched transactions"
          icon={ArrowRightLeft}
          valueClassName="!text-3xl"
        />

        <StatCard
          label="Matched Wiresheets"
          value={summary.matchedWiresheets ?? 0}
          helper="Wiresheets with matches"
          icon={FileSpreadsheet}
          valueClassName="!text-3xl"
        />

        <StatCard
          label="Total Paid"
          value={formatNumber(summary.totalPaid ?? 0)}
          helper="Total matched paid amount"
          icon={Wallet}
          valueClassName="!text-2xl break-all"
        />

        <StatCard
          label="Total Settlement"
          value={formatNumber(summary.totalSettlement ?? 0)}
          helper="Total settlement amount"
          icon={Landmark}
          valueClassName="!text-2xl break-all"
        />
      </div>

      {/* Matched wiresheets */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-on-surface">
            Matched Wiresheets
          </h3>

          <p className="mt-1 text-sm text-on-surface-variant">
            Expand a wiresheet to view its details and matched transactions.
          </p>
        </div>

        {wiresheets.length === 0 ? (
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest px-6 py-12 text-center">
            <p className="text-sm font-semibold text-on-surface">
              No matched wiresheets found.
            </p>

            <p className="mt-2 text-xs text-on-surface-variant">
              There are no matched wiresheet transactions for this payment
              sheet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {wiresheets.map((wiresheet, index) => {
              const wiresheetTransactions = transactions.filter(
                (transaction) =>
                  String(transaction.wiresheetId) ===
                  String(wiresheet.wiresheetId),
              );

              return (
                <Accordion
                  key={String(wiresheet.wiresheetId)}
                  title={wiresheet.wiresheetName || "-"}
                  subtitle={wiresheet.acquirerName || "Unknown Acquirer"}
                  icon={<FileSpreadsheet size={20} className="text-primary" />}
                  defaultOpen={index === 0}
                  meta={
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-xs text-on-surface-variant">
                          Matched Transactions
                        </p>

                        <p className="mt-1 text-sm font-bold text-on-surface">
                          {wiresheet.matchedTransactions ?? 0}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-on-surface-variant">
                          Paid Amount
                        </p>

                        <p className="mt-1 text-sm font-bold text-primary">
                          {formatNumber(wiresheet.paidAmount ?? 0)}
                        </p>
                      </div>
                    </div>
                  }
                >
                  <div className="space-y-6 border-t border-outline-variant/10 pt-5">
                    {/* Wiresheet details */}
                    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                          Period
                        </p>

                        <p className="mt-2 text-sm font-semibold text-on-surface">
                          {formatDate(wiresheet.startDate)}
                          {" - "}
                          {formatDate(wiresheet.endDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                          Status
                        </p>

                        <p className="mt-2 text-sm font-semibold capitalize text-on-surface">
                          {String(wiresheet.status || "-").replaceAll("_", " ")}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                          Paid Amount
                        </p>

                        <p className="mt-2 text-sm font-bold text-on-surface">
                          {formatNumber(wiresheet.paidAmount ?? 0)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                          Settlement Amount
                        </p>

                        <p className="mt-2 text-sm font-bold text-primary">
                          {formatNumber(wiresheet.settlementAmount ?? 0)}
                        </p>
                      </div>
                    </div>

                    {/* Existing shared DataTable */}
                    <DataTable
                      title="Matched Transactions"
                      description={`${wiresheetTransactions.length} transactions matched with this wiresheet.`}
                      columns={matchedTransactionColumns}
                      totalItems={wiresheetTransactions.length}
                      itemLabel="transactions"
                      isEmpty={wiresheetTransactions.length === 0}
                      emptyTitle="No matched transactions found."
                      emptyDescription="No payment transactions are matched with this wiresheet."
                      showFooter={false}
                    >
                      <MatchedTransactionRows
                        transactions={wiresheetTransactions}
                      />
                    </DataTable>
                  </div>
                </Accordion>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
