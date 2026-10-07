import { useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FileSpreadsheet, Globe2, Plus, ReceiptText } from "lucide-react";

import PageHeader from "../component/UI/PageHeader";
import Tabs, { readStoredTab } from "../component/UI/Tabs";
import SearchInput from "../component/UI/SearchInput";
import Button from "../component/UI/Button";
import DataTable, { readStoredRowsPerPage } from "../component/UI/DataTable";
import Modal from "../component/UI/Modal";
import DeleteModal from "../component/UI/DeleteModal";

import { selectCurrentUser } from "../store/slices/Auth.slice.js";

import MerchantSettlementRateRow from "../component/merchant-settlement/MerchantSettlementRateRow";
import MerchantSettlementRateForm from "../component/merchant-settlement/MerchantSettlementRateForm";
import MerchantSettlementApprovalRow from "../component/merchant-settlement/MerchantSettlementApprovalRow";
import MerchantSettlementRejectForm from "../component/merchant-settlement/MerchantSettlementRejectForm";
import MerchantSettlementReportView from "../component/merchant-settlement/MerchantSettlementReportView";
import MerchantSettlementCountryRow from "../component/merchant-settlement/MerchantSettlementCountryRow";
import MerchantSettlementCountryForm from "../component/merchant-settlement/MerchantSettlementCountryForm";

import {
  useMerchantSettlementFees,
  useCreateMerchantSettlementFee,
  useUpdateMerchantSettlementFee,
  useDeleteMerchantSettlementFee,
  useActivateMerchantSettlementFee,
  useMerchantSettlementFeeChangeRequests,
  useApproveMerchantSettlementFeeChangeRequest,
  useRejectMerchantSettlementFeeChangeRequest,
  useMerchantSettlementCountries,
  useCreateMerchantSettlementCountry,
  useUpdateMerchantSettlementCountry,
  useDeleteMerchantSettlementCountry,
} from "../queries/merchantSettlementQueries";

const SETTLEMENT_TABS = [
  // { label: "Transaction Lists", value: "transactions", icon: ArrowRightLeft },
  { label: "Rates", value: "rates", icon: FileSpreadsheet },
  { label: "Countries", value: "countries", icon: Globe2 },
  { label: "Reports", value: "reports", icon: ReceiptText },
];

const transactionColumns = [
  { key: "transaction", label: "Transaction" },
  { key: "merchant", label: "Merchant" },
  { key: "processing", label: "Processing" },
  { key: "country", label: "Country" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "fees", label: "Fees", align: "right" },
  { key: "settlement", label: "Settlement", align: "right" },
  { key: "status", label: "Status", align: "center" },
  { key: "match", label: "Fee Match", align: "center" },
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

const countryColumns = [
  { key: "countryName", label: "Country Name" },
  { key: "feeCountryCode", label: "Fee Country Code" },
  { key: "countryCategory", label: "Category" },
  { key: "status", label: "Status", align: "center" },
  { key: "actions", label: "Actions", align: "right" },
];

export default function MerchantSettlement() {
  const [activeTab, setActiveTab] = useState(() =>
    readStoredTab("merchant-settlement", "rates", SETTLEMENT_TABS),
  );
  const [searchQuery, setSearchQuery] = useState("");

  const [ratePage, setRatePage] = useState(1);
  const [ratePageSize, setRatePageSize] = useState(readStoredRowsPerPage);

  const [countryPage, setCountryPage] = useState(1);
  const [countryPageSize, setCountryPageSize] = useState(readStoredRowsPerPage);

  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activateTarget, setActivateTarget] = useState(null);

  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState(null);
  const [countryDeactivateTarget, setCountryDeactivateTarget] = useState(null);
  const [countryActivateTarget, setCountryActivateTarget] = useState(null);

  const currentUser = useSelector(selectCurrentUser);

  const isAdmin =
    String(currentUser?.role || "")
      .trim()
      .toLowerCase() === "admin";

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState("PENDING_APPROVAL");

  // const {
  //   data: transactionsResponse,
  //   isLoading: isTransactionsLoading,
  //   isFetching: isTransactionsFetching,
  // } = useMerchantSettlementTransactions(
  //   {
  //     search: searchQuery.trim() || undefined,
  //     page: transactionPage,
  //     limit: transactionPageSize,
  //   },
  //   {
  //     enabled: activeTab === "transactions",
  //   },
  // );

  const {
    data: ratesResponse,
    isLoading: isRatesLoading,
    isFetching: isRatesFetching,
  } = useMerchantSettlementFees(
    {
      search: searchQuery.trim() || undefined,
      page: ratePage,
      limit: ratePageSize,
    },
    {
      enabled: activeTab === "rates",
    },
  );

  const {
    data: countriesResponse,
    isLoading: isCountriesLoading,
    isFetching: isCountriesFetching,
  } = useMerchantSettlementCountries(
    {
      search: searchQuery.trim() || undefined,
      status: "all",
      page: countryPage,
      limit: countryPageSize,
    },
    {
      enabled: activeTab === "countries",
    },
  );

  const createRateMutation = useCreateMerchantSettlementFee();
  const updateRateMutation = useUpdateMerchantSettlementFee();
  const deactivateRateMutation = useDeleteMerchantSettlementFee();
  const activateRateMutation = useActivateMerchantSettlementFee();
  const createCountryMutation = useCreateMerchantSettlementCountry();
  const updateCountryMutation = useUpdateMerchantSettlementCountry();
  const { data: pendingApprovalRequests = [] } =
    useMerchantSettlementFeeChangeRequests(
      {
        status: "PENDING_APPROVAL",
      },
      {
        enabled: activeTab === "rates",
      },
    );

  const isCountryStatusPending = updateCountryMutation.isPending;

  const isSubmittingCountry =
    createCountryMutation.isPending || updateCountryMutation.isPending;

  const {
    data: approvalRequests = [],
    isLoading: isApprovalsLoading,
    isFetching: isApprovalsFetching,
  } = useMerchantSettlementFeeChangeRequests(
    {
      status: approvalStatus,
    },
    {
      enabled: activeTab === "rates" && isApprovalModalOpen,
    },
  );

  const approveRateMutation = useApproveMerchantSettlementFeeChangeRequest();

  const rejectRateMutation = useRejectMerchantSettlementFeeChangeRequest();

  const isApprovalActionPending =
    approveRateMutation.isPending || rejectRateMutation.isPending;

  const isSubmittingRate =
    createRateMutation.isPending || updateRateMutation.isPending;

  const isDeactivatingRate = deactivateRateMutation.isPending;

  const isActivatingRate = activateRateMutation.isPending;

  const isRateStatusPending = isDeactivatingRate || isActivatingRate;

  const rates = ratesResponse?.items ?? [];

  const rateMeta = ratesResponse?.meta ?? {
    total: 0,
    page: ratePage,
    limit: ratePageSize,
    totalPages: 0,
  };

  const countries = countriesResponse?.items ?? [];

  const countryMeta = countriesResponse?.meta ?? {
    total: 0,
    page: countryPage,
    limit: countryPageSize,
    totalPages: 0,
  };

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

  const handleOpenAddCountry = () => {
    if (!isAdmin) return;

    setEditingCountry(null);
    setIsCountryModalOpen(true);
  };

  const handleOpenEditCountry = (country) => {
    if (!isAdmin) return;

    setEditingCountry(country);
    setIsCountryModalOpen(true);
  };

  const closeCountryModal = () => {
    setEditingCountry(null);
    setIsCountryModalOpen(false);
  };

  const handleCloseCountryModal = () => {
    if (isSubmittingCountry) return;

    closeCountryModal();
  };

  const handleSubmitCountry = async (payload) => {
    if (!isAdmin) return;

    try {
      let result;

      if (editingCountry) {
        result = await updateCountryMutation.mutateAsync({
          id: editingCountry._id || editingCountry.id,
          payload,
        });
      } else {
        result = await createCountryMutation.mutateAsync(payload);
      }

      toast.success(
        result?.message ||
          (editingCountry
            ? "Country updated successfully."
            : "Country added successfully."),
      );

      closeCountryModal();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to save country.",
      );
    }
  };

  const handleConfirmCountryDeactivate = async () => {
    if (!countryDeactivateTarget || !isAdmin) return;

    try {
      const result = await updateCountryMutation.mutateAsync({
        id: countryDeactivateTarget._id || countryDeactivateTarget.id,
        payload: {
          status: "inactive",
        },
      });

      toast.success(result?.message || "Country deactivated successfully.");

      setCountryDeactivateTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to deactivate country.",
      );
    }
  };

  const handleConfirmCountryActivate = async () => {
    if (!countryActivateTarget || !isAdmin) return;

    try {
      const result = await updateCountryMutation.mutateAsync({
        id: countryActivateTarget._id || countryActivateTarget.id,
        payload: {
          status: "active",
        },
      });

      toast.success(result?.message || "Country reactivated successfully.");

      setCountryActivateTarget(null);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to reactivate country.",
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
    if (activeTab === "rates") {
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
    }

    if (activeTab === "countries" && isAdmin) {
      return (
        <Button
          type="button"
          leftIcon={<Plus size={16} />}
          onClick={handleOpenAddCountry}
        >
          Add Country
        </Button>
      );
    }

    return null;
  };

  const renderContent = () => {
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

    if (activeTab === "countries") {
      return (
        <DataTable
          title="Country Master"
          columns={countryColumns}
          page={countryPage}
          pageSize={countryPageSize}
          totalItems={countryMeta.total}
          onPageChange={setCountryPage}
          onRowsPerPageChange={setCountryPageSize}
          isLoading={isCountriesLoading}
          isFetching={isCountriesFetching}
          itemLabel="countries"
          isEmpty={countries.length === 0}
          emptyTitle={
            searchQuery.trim()
              ? "No matching countries found."
              : "No countries found."
          }
          emptyDescription={
            searchQuery.trim()
              ? "Try adjusting your search."
              : "Country master records will appear here."
          }
          emptyIcon={Globe2}
        >
          {countries.map((country) => (
            <MerchantSettlementCountryRow
              key={country._id || country.id}
              country={country}
              onEdit={handleOpenEditCountry}
              onDeactivate={setCountryDeactivateTarget}
              onActivate={setCountryActivateTarget}
              canManage={isAdmin}
              isStatusPending={isCountryStatusPending}
            />
          ))}
        </DataTable>
      );
    }

    return (
      <MerchantSettlementReportView
        searchQuery={searchQuery}
        onResetSearch={() => setSearchQuery("")}
      />
    );
  };

  return (
    <div className="w-full bg-background text-on-background">
      <PageHeader
        title="Merchant Settlement"
        description="Manage merchant rates, country configurations, and settlement reports."
        className="mb-6"
      />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          persistenceKey="merchant-settlement"
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
              activeTab === "rates"
                ? "Search rates..."
                : activeTab === "countries"
                  ? "Search countries..."
                  : "Search reports..."
            }
            className="w-full sm:w-80"
            onChange={(event) => {
              setSearchQuery(event.target.value);

              if (activeTab === "rates") {
                setRatePage(1);
              }

              if (activeTab === "countries") {
                setCountryPage(1);
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

      {/* Add / Edit Country modal */}
      <Modal
        open={isCountryModalOpen}
        title={editingCountry ? "Edit Country" : "Add Country"}
        description={
          editingCountry
            ? "Update the selected country master record."
            : "Add a new country to the country master."
        }
        size="md"
        onClose={handleCloseCountryModal}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseCountryModal}
              disabled={isSubmittingCountry}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="merchant-country-form"
              disabled={isSubmittingCountry}
              loading={isSubmittingCountry}
            >
              {editingCountry ? "Update Country" : "Add Country"}
            </Button>
          </>
        }
      >
        <MerchantSettlementCountryForm
          formId="merchant-country-form"
          initialValues={editingCountry}
          onSubmit={handleSubmitCountry}
        />
      </Modal>

      {/* Reactivate country modal*/}
      <Modal
        open={Boolean(countryActivateTarget)}
        title="Reactivate Country?"
        description="This country will become active and available for matching again."
        size="sm"
        onClose={
          isCountryStatusPending
            ? undefined
            : () => setCountryActivateTarget(null)
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={isCountryStatusPending}
              onClick={() => setCountryActivateTarget(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              loading={isCountryStatusPending}
              disabled={isCountryStatusPending}
              onClick={handleConfirmCountryActivate}
            >
              Reactivate Country
            </Button>
          </>
        }
      />

      {/* Delete Country modal */}
      <DeleteModal
        open={Boolean(countryDeactivateTarget)}
        title="Deactivate Country?"
        description="This country will remain in the country master but will no longer be active for matching."
        confirmLabel="Deactivate Country"
        isLoading={isCountryStatusPending}
        onClose={() => setCountryDeactivateTarget(null)}
        onConfirm={handleConfirmCountryDeactivate}
      />
    </div>
  );
}
