import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
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
import DataTable, { readStoredRowsPerPage } from "../component/UI/DataTable";
import Modal from "../component/UI/Modal";
import DeleteModal from "../component/UI/DeleteModal";

import { selectCurrentUser } from "../store/slices/Auth.slice.js";

import MerchantSettlementTransactionRow from "../component/merchant-settlement/MerchantSettlementTransactionRow";
import MerchantSettlementRateRow from "../component/merchant-settlement/MerchantSettlementRateRow";
import MerchantSettlementRateForm from "../component/merchant-settlement/MerchantSettlementRateForm";
import MerchantSettlementApprovalRow from "../component/merchant-settlement/MerchantSettlementApprovalRow";
import MerchantSettlementRejectForm from "../component/merchant-settlement/MerchantSettlementRejectForm";
import MerchantSettlementReportView from "../component/merchant-settlement/MerchantSettlementReportView";

import {
  useMerchantSettlementFees,
  useCreateMerchantSettlementFee,
  useUpdateMerchantSettlementFee,
  useDeleteMerchantSettlementFee,
  useActivateMerchantSettlementFee,
  useMerchantSettlementFeeChangeRequests,
  useApproveMerchantSettlementFeeChangeRequest,
  useRejectMerchantSettlementFeeChangeRequest,
} from "../queries/merchantSettlementQueries";

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
  { key: "merchant", label: "Merchant" },
  { key: "processing", label: "Processing" },
  { key: "countryGateway", label: "Country / Gateway" },
  { key: "mdr", label: "MDR", align: "right" },
  { key: "transactionFees", label: "Transaction Fees", align: "right" },
  { key: "reserveSettlement", label: "Reserve / Settlement" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "right" },
];

const approvalColumns = [
  { key: "merchant", label: "Merchant" },
  { key: "action", label: "Request Type" },
  { key: "changes", label: "Changes" },
  { key: "requestedBy", label: "Requested By" },
  { key: "reason", label: "Reason" },
  { key: "status", label: "Status", align: "center" },
  { key: "actions", label: "Actions", align: "right" },
];

export default function MerchantSettlement() {
  const [activeTab, setActiveTab] = useState("transactions");
  const [searchQuery, setSearchQuery] = useState("");
  const [ratePage, setRatePage] = useState(1);
  const [ratePageSize, setRatePageSize] = useState(readStoredRowsPerPage);

  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activateTarget, setActivateTarget] = useState(null);

  const currentUser = useSelector(selectCurrentUser);

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState("PENDING_APPROVAL");

  const {
    data: ratesResponse,
    isLoading: isRatesLoading,
    isFetching: isRatesFetching,
  } = useMerchantSettlementFees({
    search: searchQuery.trim() || undefined,
    page: ratePage,
    limit: ratePageSize,
  });

  const createRateMutation = useCreateMerchantSettlementFee();
  const updateRateMutation = useUpdateMerchantSettlementFee();
  const deactivateRateMutation = useDeleteMerchantSettlementFee();
  const activateRateMutation = useActivateMerchantSettlementFee();
  const { data: pendingApprovalRequests = [] } =
    useMerchantSettlementFeeChangeRequests({
      status: "PENDING_APPROVAL",
    });

  const {
    data: approvalRequests = [],
    isLoading: isApprovalsLoading,
    isFetching: isApprovalsFetching,
  } = useMerchantSettlementFeeChangeRequests({
    status: approvalStatus,
  });

  const approveRateMutation = useApproveMerchantSettlementFeeChangeRequest();

  const rejectRateMutation = useRejectMerchantSettlementFeeChangeRequest();

  const isApprovalActionPending =
    approveRateMutation.isPending || rejectRateMutation.isPending;

  const isSubmittingRate =
    createRateMutation.isPending || updateRateMutation.isPending;

  const isDeactivatingRate = deactivateRateMutation.isPending;

  const isActivatingRate = activateRateMutation.isPending;

  const isRateStatusPending = isDeactivatingRate || isActivatingRate;

  // temporary until their APIs are connected
  const transactions = [];
  const reports = [];

  const rates = ratesResponse?.items ?? [];

  const rateMeta = ratesResponse?.meta ?? {
    total: 0,
    page: ratePage,
    limit: ratePageSize,
    totalPages: 0,
  };

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

  const handleOpenAddRate = () => {
    setEditingRate(null);
    setIsRateModalOpen(true);
  };

  const handleOpenEditRate = (rate) => {
    setEditingRate(rate);
    setIsRateModalOpen(true);
  };

  const closeRateModal = () => {
    setEditingRate(null);
    setIsRateModalOpen(false);
  };

  const handleCloseRateModal = () => {
    if (isSubmittingRate) return;

    closeRateModal();
  };

  const handleSubmitRate = async (payload) => {
    try {
      let result;

      if (editingRate) {
        result = await updateRateMutation.mutateAsync({
          id: editingRate._id || editingRate.id,
          payload,
        });
      } else {
        result = await createRateMutation.mutateAsync(payload);
      }

      toast.success(
        result?.message ||
          (editingRate
            ? "Rate change request submitted successfully."
            : "Rate create request submitted successfully."),
      );

      closeRateModal();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to submit rate request.",
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const result = await deactivateRateMutation.mutateAsync(
        deleteTarget._id || deleteTarget.id,
      );

      toast.success(
        result?.message || "Merchant rate deactivated successfully.",
      );

      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to deactivate merchant rate.",
      );
    }
  };

  const handleConfirmActivate = async () => {
    if (!activateTarget) return;

    try {
      const result = await activateRateMutation.mutateAsync(
        activateTarget._id || activateTarget.id,
      );

      toast.success(result?.message || "Merchant rate activated successfully.");

      setActivateTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to activate merchant rate.",
      );
    }
  };

  const handleConfirmApproval = async () => {
    if (!approveTarget) return;

    try {
      const result = await approveRateMutation.mutateAsync({
        id: approveTarget._id || approveTarget.id,
      });

      toast.success(
        result?.message || "Rate change request approved successfully.",
      );

      setApproveTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to approve rate change request.",
      );
    }
  };

  const handleConfirmRejection = async ({ checkerComment }) => {
    if (!rejectTarget) return;

    try {
      const result = await rejectRateMutation.mutateAsync({
        id: rejectTarget._id || rejectTarget.id,
        checkerComment,
      });

      toast.success(
        result?.message || "Rate change request rejected successfully.",
      );

      setRejectTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to reject rate change request.",
      );
    }
  };

  const renderActions = () => {
    if (activeTab !== "rates") {
      return null;
    }

    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setApprovalStatus("PENDING_APPROVAL");
            setIsApprovalModalOpen(true);
          }}
        >
          Approvals
          {pendingApprovalRequests.length > 0 ? (
            <span>({pendingApprovalRequests.length})</span>
          ) : null}
        </Button>

        <Button
          type="button"
          leftIcon={<Plus size={16} />}
          onClick={handleOpenAddRate}
        >
          Add Rate
        </Button>
      </div>
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
          page={ratePage}
          pageSize={ratePageSize}
          totalItems={rateMeta.total}
          onPageChange={setRatePage}
          onRowsPerPageChange={setRatePageSize}
          isLoading={isRatesLoading}
          isFetching={isRatesFetching}
          itemLabel="rates"
          isEmpty={rates.length === 0}
          emptyTitle={
            searchQuery.trim() ? "No matching rates found." : "No rates found."
          }
          emptyDescription={
            searchQuery.trim()
              ? "Try adjusting your search."
              : "Add merchant settlement rates to begin report calculations."
          }
          emptyIcon={FileSpreadsheet}
        >
          {rates.map((rate) => (
            <MerchantSettlementRateRow
              key={rate._id || rate.id}
              rate={rate}
              onEdit={handleOpenEditRate}
              onDeactivate={setDeleteTarget}
              onActivate={setActivateTarget}
              canManage
              isStatusPending={isRateStatusPending}
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
            onChange={(event) => {
              setSearchQuery(event.target.value);

              if (activeTab === "rates") {
                setRatePage(1);
              }
            }}
          />

          {renderActions()}
        </div>
      </div>
      {renderContent()}

      {/* Edit rate modal */}
      <Modal
        open={isRateModalOpen}
        title={editingRate ? "Edit Rate" : "Add Rate"}
        description={
          editingRate
            ? "Update the rate configuration and submit it for checker approval."
            : "Create a new rate configuration and submit it for checker approval."
        }
        size="xl"
        onClose={handleCloseRateModal}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseRateModal}
              disabled={isSubmittingRate}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="merchant-rate-form"
              disabled={isSubmittingRate}
              loading={isSubmittingRate}
            >
              {editingRate ? "Submit Changes" : "Submit Rate"}
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

      {/* Approval request Modal */}
      <Modal
        open={isApprovalModalOpen}
        title={
          approvalStatus === "REJECTED"
            ? "Rejected Rate Requests"
            : "Pending Rate Approvals"
        }
        description={
          approvalStatus === "REJECTED"
            ? "Review rejected rate change requests and their rejection reasons."
            : "Review rate change requests waiting for checker approval."
        }
        size="xl"
        onClose={
          isApprovalActionPending
            ? undefined
            : () => setIsApprovalModalOpen(false)
        }
      >
        <div className="mb-4 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={
              approvalStatus === "PENDING_APPROVAL" ? "primary" : "secondary"
            }
            onClick={() => setApprovalStatus("PENDING_APPROVAL")}
          >
            Pending
          </Button>

          <Button
            type="button"
            size="sm"
            variant={approvalStatus === "REJECTED" ? "primary" : "secondary"}
            onClick={() => setApprovalStatus("REJECTED")}
          >
            Rejected
          </Button>
        </div>

        <DataTable
          title="Requests"
          columns={approvalColumns}
          totalItems={approvalRequests.length}
          itemLabel="requests"
          isLoading={isApprovalsLoading}
          isFetching={isApprovalsFetching}
          isEmpty={approvalRequests.length === 0}
          emptyTitle={
            approvalStatus === "REJECTED"
              ? "No rejected requests."
              : "No pending approvals."
          }
          emptyDescription={
            approvalStatus === "REJECTED"
              ? "Rejected rate change requests will appear here."
              : "Rate change requests waiting for approval will appear here."
          }
          emptyIcon={FileSpreadsheet}
        >
          {approvalRequests.map((request) => (
            <MerchantSettlementApprovalRow
              key={request._id || request.id}
              request={request}
              currentUser={currentUser}
              onApprove={setApproveTarget}
              onReject={setRejectTarget}
              isActionPending={isApprovalActionPending}
            />
          ))}
        </DataTable>
      </Modal>

      {/* Approval confirmation modal */}
      <Modal
        open={Boolean(approveTarget)}
        title="Approve Rate Change?"
        description="This will apply the requested rate change."
        size="sm"
        onClose={
          approveRateMutation.isPending
            ? undefined
            : () => setApproveTarget(null)
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={approveRateMutation.isPending}
              onClick={() => setApproveTarget(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              loading={approveRateMutation.isPending}
              disabled={approveRateMutation.isPending}
              onClick={handleConfirmApproval}
            >
              Approve
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-on-surface-variant">
          Approving this request will apply the proposed rate configuration.
        </p>
      </Modal>

      {/* Reject request modal */}

      <Modal
        open={Boolean(rejectTarget)}
        title="Reject Rate Change?"
        description="Provide a reason for rejecting this rate change request."
        size="sm"
        onClose={
          rejectRateMutation.isPending ? undefined : () => setRejectTarget(null)
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={rejectRateMutation.isPending}
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="merchant-rate-reject-form"
              loading={rejectRateMutation.isPending}
              disabled={rejectRateMutation.isPending}
            >
              Reject Request
            </Button>
          </>
        }
      >
        <MerchantSettlementRejectForm
          formId="merchant-rate-reject-form"
          request={rejectTarget}
          onSubmit={handleConfirmRejection}
        />
      </Modal>

      {/* Delete/Deactivate modal */}

      <DeleteModal
        open={Boolean(deleteTarget)}
        title="Deactivate Rate?"
        description="This will deactivate this merchant rate configuration."
        confirmLabel="Deactivate Rate"
        isLoading={isDeactivatingRate}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
      {/* Activate fees modal */}
      <Modal
        open={Boolean(activateTarget)}
        title="Activate Rate?"
        description="This will activate this merchant rate configuration."
        size="sm"
        onClose={isActivatingRate ? undefined : () => setActivateTarget(null)}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={isActivatingRate}
              onClick={() => setActivateTarget(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              loading={isActivatingRate}
              disabled={isActivatingRate}
              onClick={handleConfirmActivate}
            >
              Activate Rate
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-on-surface-variant">
          The merchant rate will become active and available for use again.
        </p>
      </Modal>
    </div>
  );
}
