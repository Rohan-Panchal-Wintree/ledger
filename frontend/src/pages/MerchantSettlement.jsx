import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  FileSpreadsheet,
  Plus,
  ReceiptText,
  Upload,
} from "lucide-react";

import PageHeader from "../component/UI/PageHeader";
import Tabs from "../component/UI/Tabs";
import SearchInput from "../component/UI/SearchInput";
import Button from "../component/UI/Button";
import DataTable from "../component/UI/DataTable";
import Modal from "../component/UI/Modal";
import DeleteModal from "../component/UI/DeleteModal";

import MerchantSettlementTransactionRow from "../component/merchant-settlement/MerchantSettlementTransactionRow";
import MerchantSettlementRateRow from "../component/merchant-settlement/MerchantSettlementRateRow";
import MerchantSettlementRateForm from "../component/merchant-settlement/MerchantSettlementRateForm";
import MerchantSettlementReportView from "../component/merchant-settlement/MerchantSettlementReportView";

const SETTLEMENT_TABS = [
  { label: "Transaction Lists", value: "transactions", icon: ArrowRightLeft },
  { label: "Rates", value: "rates", icon: FileSpreadsheet },
  { label: "Reports", value: "reports", icon: ReceiptText },
];

const transactionColumns = [
  { key: "transactionId", label: "Transaction ID" },
  { key: "merchantId", label: "Merchant ID" },
  { key: "merchantName", label: "Merchant Name" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "currency", label: "Currency" },
  { key: "status", label: "Status", align: "center" },
  { key: "createdAt", label: "Created At" },
];

const rateColumns = [
  { key: "merchantId", label: "Merchant ID" },
  { key: "merchantName", label: "Merchant Name" },
  { key: "partner", label: "Partner" },
  { key: "currency", label: "Currency" },
  { key: "accountId", label: "Account ID" },
  { key: "country", label: "Country" },
  { key: "brand", label: "Brand" },
  { key: "mdr", label: "MDR", align: "right" },
  { key: "approvalFee", label: "Approval Fee", align: "right" },
  { key: "declineFee", label: "Decline Fee", align: "right" },
  { key: "reversalFee", label: "Reversal Fee", align: "right" },
  { key: "chargebackFee", label: "Chargeback Fee", align: "right" },
  { key: "rr", label: "RR", align: "right" },
  { key: "settlementExp", label: "Settlement Exp", align: "right" },
  { key: "actions", label: "Actions", align: "right" },
];

export default function MerchantSettlement() {
  const [activeTab, setActiveTab] = useState("transactions");
  const [searchQuery, setSearchQuery] = useState("");

  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // temporary until API is connected
  const transactions = [];
  const rates = [];
  const reports = [];

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return transactions;

    return transactions.filter((item) =>
      [
        item.transactionId,
        item.merchantId,
        item.merchantName,
        item.currency,
        item.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [searchQuery, transactions]);

  const filteredRates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rates;

    return rates.filter((item) =>
      [
        item.merchantId,
        item.merchantName,
        item.partner,
        item.currency,
        item.accountId,
        item.country,
        item.brand,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [searchQuery, rates]);

  const handleOpenAddRate = () => {
    setEditingRate(null);
    setIsRateModalOpen(true);
  };

  const handleOpenEditRate = (rate) => {
    setEditingRate(rate);
    setIsRateModalOpen(true);
  };

  const handleCloseRateModal = () => {
    setEditingRate(null);
    setIsRateModalOpen(false);
  };

  const handleSubmitRate = async () => {
    // wire mutation after backend endpoint is confirmed
  };

  const handleConfirmDelete = async () => {
    // wire delete mutation after backend endpoint is confirmed
  };

  const renderActions = () => {
    if (activeTab !== "rates") {
      return null;
    }

    return (
      <Button
        type="button"
        leftIcon={<Plus size={16} />}
        onClick={handleOpenAddRate}
      >
        Add Rate
      </Button>
    );
  };

  const renderContent = () => {
    if (activeTab === "transactions") {
      return (
        <DataTable
          title="Transaction Lists"
          columns={transactionColumns}
          totalItems={filteredTransactions.length}
          itemLabel="transactions"
          isEmpty={filteredTransactions.length === 0}
          emptyTitle="No transactions found."
          emptyDescription="Uploaded payment gateway transactions will appear here."
          emptyIcon={Upload}
        >
          {filteredTransactions.map((item) => (
            <MerchantSettlementTransactionRow key={item.id} item={item} />
          ))}
        </DataTable>
      );
    }

    if (activeTab === "rates") {
      return (
        <DataTable
          title="Merchant Rates"
          columns={rateColumns}
          totalItems={filteredRates.length}
          itemLabel="rates"
          isEmpty={filteredRates.length === 0}
          emptyTitle="No rates found."
          emptyDescription="Add merchant settlement rates to begin report calculations."
          emptyIcon={FileSpreadsheet}
        >
          {filteredRates.map((item) => (
            <MerchantSettlementRateRow
              key={item.id}
              item={item}
              onEdit={handleOpenEditRate}
              onDelete={setDeleteTarget}
            />
          ))}
        </DataTable>
      );
    }

    return <MerchantSettlementReportView reports={reports} />;
  };

  return (
    <div className="w-full bg-background text-on-background">
      <PageHeader
        title="Merchant Settlement"
        description="Manage gateway transactions, merchant rates, and settlement reports."
        className="mb-6"
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          activeTab={activeTab}
          onChange={(nextTab) => {
            setActiveTab(nextTab);
            setSearchQuery("");
          }}
          tabs={SETTLEMENT_TABS}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={searchQuery}
            placeholder={
              activeTab === "transactions"
                ? "Search transactions..."
                : activeTab === "rates"
                  ? "Search rates..."
                  : "Search reports..."
            }
            className="w-full sm:w-80"
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          {renderActions()}
        </div>
      </div>

      {renderContent()}

      <Modal
        open={isRateModalOpen}
        title={editingRate ? "Edit Rate" : "Add Rate"}
        description="Manage merchant settlement rate configuration."
        size="xl"
        onClose={handleCloseRateModal}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseRateModal}
            >
              Cancel
            </Button>

            <Button type="submit" form="merchant-rate-form">
              {editingRate ? "Update Rate" : "Add Rate"}
            </Button>
          </>
        }
      >
        <MerchantSettlementRateForm
          formId="merchant-rate-form"
          initialValues={editingRate}
          onSubmit={handleSubmitRate}
        />
      </Modal>

      <DeleteModal
        open={Boolean(deleteTarget)}
        title="Delete Rate?"
        description="This will permanently delete this merchant rate configuration."
        confirmLabel="Delete Rate"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
