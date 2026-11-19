const validDate = (value) => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date : null;
};

// Financial queries retain the original coverage of BOTH source files even
// after the displayed reporting period is narrowed to datestamp transactions.
export const getReportTransactionPeriod = (report) =>
	report.transactionPeriod || report.reportData?.transactionPeriod || {
		fromDate: report.fromDate,
		toDate: report.toDate,
	};

const cachedPeriod = (report) => {
	const data = report.reportData || report;
	if (!Object.hasOwn(data, "datestampPeriod")) return undefined;
	const period = data.datestampPeriod;
	if (!period || (!period.fromDate && !period.toDate)) return { fromDate: null, toDate: null };
	const fromDate = validDate(period.fromDate);
	const toDate = validDate(period.toDate);
	return fromDate && toDate && fromDate <= toDate ? { fromDate, toDate } : undefined;
};

export const applyDatestampReportPeriod = (report, period) => {
	const datestampPeriod = {
		fromDate: validDate(period?.fromDate),
		toDate: validDate(period?.toDate),
	};
	return {
		...report,
		...datestampPeriod,
		datestampPeriod,
		reportData: {
			...report.reportData,
			transactionPeriod: getReportTransactionPeriod(report),
			datestampPeriod,
			...datestampPeriod,
		},
	};
};

// Legacy saved reports have mixed-source dates. Resolve a page of them in one
// aggregate, without changing their financial snapshots or writing to MongoDB.
export const resolveDatestampReportPeriods = async (reports, { Transaction, getTransactionQuery }) => {
	const pending = [];
	const periods = reports.map((report, index) => {
		const period = cachedPeriod(report);
		if (period !== undefined) return period;
		if (report.settlementBatchId && report.memberId) pending.push({ report, index });
		return { fromDate: null, toDate: null };
	});
	if (pending.length) {
		const scopes = pending.map(({ report }) => getTransactionQuery(report, "matched"));
		const facets = Object.fromEntries(scopes.map((scope, index) => [`report${index}`, [
			{ $match: scope },
			{ $group: { _id: null, fromDate: { $min: "$transactionDate" }, toDate: { $max: "$transactionDate" } } },
		]]));
		const [result = {}] = await Transaction.aggregate([
			{ $match: { $and: [
				{ $or: scopes },
				{ sourceFileType: "datestamp" },
				{ transactionDate: { $type: "date" } },
			] } },
			{ $facet: facets },
		]);
		for (let index = 0; index < pending.length; index++) {
			periods[pending[index].index] = result[`report${index}`]?.[0] || { fromDate: null, toDate: null };
		}
	}
	return reports.map((report, index) => applyDatestampReportPeriod(report, periods[index]));
};

export const resolveDatestampBatchPeriods = async (batches, Transaction) => {
	if (!batches.length) return batches;
	const periods = await Transaction.aggregate([
		{ $match: { settlementBatchId: { $in: batches.map((batch) => batch._id) },
			sourceFileType: "datestamp", matchStatus: "matched", transactionDate: { $type: "date" } } },
		{ $group: { _id: "$settlementBatchId", fromDate: { $min: "$transactionDate" }, toDate: { $max: "$transactionDate" } } },
	]);
	const byId = new Map(periods.map((period) => [String(period._id), period]));
	return batches.map((batch) => {
		const period = byId.get(String(batch._id));
		const datestampPeriod = { fromDate: period?.fromDate || null, toDate: period?.toDate || null };
		return { ...batch, ...datestampPeriod, datestampPeriod };
	});
};
