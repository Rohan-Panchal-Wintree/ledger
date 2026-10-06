import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import Button from "../UI/Button";
import DatePicker from "../UI/DatePicker";

import { useReportDates } from "../../queries/reportQueries";

import { getErrorMessage } from "../../utils/appUtils";

const EMPTY_REPORT_FILTERS = {
	paymentDate: "",
	fromDate: "",
	toDate: "",
	banks: "",
	merchants: "",
	mids: "",
	currencies: "",
	paymentMethods: "",
	statuses: "",
};

function getValidRecentReportDates(dates = [], maxDate) {
	return dates
		.filter((date) => {
			const parsedDate = new Date(date);

			return !Number.isNaN(parsedDate.getTime()) && date <= maxDate;
		})
		.sort((a, b) => new Date(b) - new Date(a))
		.slice(0, 5);
}

export default function ReportDateSelector({
	appliedFilters = EMPTY_REPORT_FILTERS,
	draftFilters = EMPTY_REPORT_FILTERS,
	isFetching = false,
	onApplyDate,
	onFilterChange,
	onSearchReports,
	onClearFilters,
}) {
	const today = new Date().toISOString().slice(0, 10);

	const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

	const reportDatesQuery = useReportDates();

	const reportDateButtons = useMemo(
		() => getValidRecentReportDates(reportDatesQuery.data || [], today),
		[reportDatesQuery.data, today],
	);

	const handleReportDateClick = (date) => {
		if (appliedFilters.paymentDate === date) {
			onApplyDate?.("");
			return;
		}

		onApplyDate?.(date);
	};

	const handleGetReport = () => {
		if (!draftFilters.paymentDate) return;

		onApplyDate?.(draftFilters.paymentDate);
	};

	const handleClearDate = () => {
		onApplyDate?.("");
	};

	if (reportDatesQuery.error) {
		toast.error(
			getErrorMessage(reportDatesQuery.error, "Failed to load report dates."),
		);
	}

	return (
		<div className="rounded-2xl bg-surface-lowest px-5 py-5">
			<div className="flex flex-col gap-6">
				<div>
					<h2 className="text-lg font-bold tracking-tight text-on-surface">
						Search Payment Report
					</h2>

					<p className="mt-1 text-sm text-surface-variant">
						Choose a quick payment date, or search using date range and filters.
						Excel/PDF exports use the same applied search.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<DatePicker
						value={draftFilters.paymentDate}
						max={today}
						onChange={(value) =>
							onFilterChange?.({
								target: {
									name: "paymentDate",
									value,
								},
							})
						}
						onApply={handleGetReport}
						onClear={handleClearDate}
						applyDisabled={!draftFilters.paymentDate || isFetching}
						showClear={Boolean(
							draftFilters.paymentDate || appliedFilters.paymentDate,
						)}
					/>

					<div className="flex flex-wrap gap-2">
						{reportDateButtons.map((date) => (
							<Button
								key={date}
								type="button"
								onClick={() => handleReportDateClick(date)}
								variant={
									appliedFilters.paymentDate === date ? "primary" : "secondary"
								}
								size="sm"
								disabled={isFetching}
							>
								{date}
							</Button>
						))}
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline/60 pt-4">
					<div>
						<p className="text-sm font-semibold text-on-surface">
							Need more filters?
						</p>
						<p className="text-xs text-surface-variant">
							Search by date range, bank, merchant, MID, currency, method, or
							status.
						</p>
					</div>

					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={() => setShowAdvancedSearch((prev) => !prev)}
					>
						{showAdvancedSearch ? "Hide Advanced Search" : "Advanced Search"}
					</Button>
				</div>

				{showAdvancedSearch ? (
					<div className="space-y-4 rounded-2xl border border-outline bg-surface px-4 py-4">
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
							<label className="space-y-1">
								<span className="text-xs font-medium text-surface-variant">
									From Date
								</span>
								<input
									type="date"
									name="fromDate"
									value={draftFilters.fromDate}
									max={today}
									onChange={onFilterChange}
									className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
								/>
							</label>

							<label className="space-y-1">
								<span className="text-xs font-medium text-surface-variant">
									To Date
								</span>
								<input
									type="date"
									name="toDate"
									value={draftFilters.toDate}
									max={today}
									onChange={onFilterChange}
									className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
								/>
							</label>

							<label className="space-y-1">
								<span className="text-xs font-medium text-surface-variant">
									Banks / Acquirers
								</span>
								<input
									type="text"
									name="banks"
									value={draftFilters.banks}
									onChange={onFilterChange}
									placeholder="Dimoco, Paynetics"
									className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
								/>
							</label>

							<label className="space-y-1">
								<span className="text-xs font-medium text-surface-variant">
									Merchants
								</span>
								<input
									type="text"
									name="merchants"
									value={draftFilters.merchants}
									onChange={onFilterChange}
									placeholder="Merchant A, Merchant B"
									className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
								/>
							</label>

							<label className="space-y-1">
								<span className="text-xs font-medium text-surface-variant">
									MIDs
								</span>
								<input
									type="text"
									name="mids"
									value={draftFilters.mids}
									onChange={onFilterChange}
									placeholder="16452, 15585"
									className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
								/>
							</label>

							<label className="space-y-1">
								<span className="text-xs font-medium text-surface-variant">
									Currencies
								</span>
								<input
									type="text"
									name="currencies"
									value={draftFilters.currencies}
									onChange={onFilterChange}
									placeholder="EUR, USD, USDT"
									className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
								/>
							</label>

							<label className="space-y-1">
								<span className="text-xs font-medium text-surface-variant">
									Payment Methods
								</span>
								<input
									type="text"
									name="paymentMethods"
									value={draftFilters.paymentMethods}
									onChange={onFilterChange}
									placeholder="CRYPTO, WIRE"
									className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
								/>
							</label>

							<label className="space-y-1">
								<span className="text-xs font-medium text-surface-variant">
									Statuses
								</span>
								<input
									type="text"
									name="statuses"
									value={draftFilters.statuses}
									onChange={onFilterChange}
									placeholder="settled, partially_paid, pending"
									className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
								/>
							</label>
						</div>
					</div>
				) : null}

				<div className="flex flex-wrap items-center justify-end gap-2">
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={onClearFilters}
						disabled={isFetching}
					>
						Clear
					</Button>

					<Button
						type="button"
						size="sm"
						onClick={onSearchReports}
						loading={isFetching}
					>
						Search
					</Button>
				</div>
			</div>
		</div>
	);
}
