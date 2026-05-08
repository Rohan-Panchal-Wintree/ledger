import PDFDocument from "pdfkit";
import xlsx from "xlsx";

import { Payment } from "../models/payment.model.js";
import { MiscellaneousPayment } from "../models/miscellaneous-payment.model.js";

const toNumber = (value) => Number(value) || 0;

const startOfDate = (value) => {
	const date = new Date(value);
	date.setUTCHours(0, 0, 0, 0);
	return date;
};

const endOfDate = (value) => {
	const date = new Date(value);
	date.setUTCHours(23, 59, 59, 999);
	return date;
};

const getDateRange = (paymentDate) => ({
	$gte: startOfDate(paymentDate),
	$lte: endOfDate(paymentDate),
});

const getDisplayCurrency = (currency, paymentMethod) => {
	if (paymentMethod === "CRYPTO" && currency === "USD") return "USDT";
	return currency || "UNKNOWN";
};

const miscLabels = {
	repayment: "Repayment",
	bank_rr: "Bank RR",
	rr: "Cap RR",
	agent: "Agent",
	overcapped_rr_refund: "Overcapped RR Refund",
	chb_refund: "CHB Refund",
	adjustment: "Adjustment",
	other: "Other",
};

const getLedgerRowsDirect = async ({ paymentDate, acquirer }) => {
	const paymentDateMatch = paymentDate
		? { paidToMerchantDate: getDateRange(paymentDate) }
		: {};

	const payments = await Payment.find(paymentDateMatch)
		.populate({
			path: "wiresheetTransactionId",
			populate: [
				{ path: "merchantId", select: "merchantName merchantTag" },
				{
					path: "merchantMappingId",
					select:
						"mid acquirerId processingCurrency settlementCurrency paymentMethod",
					populate: { path: "acquirerId", select: "name" },
				},
			],
		})
		.populate({
			path: "merchantMappingId",
			select:
				"mid acquirerId processingCurrency settlementCurrency paymentMethod",
			populate: { path: "acquirerId", select: "name" },
		})
		.sort({ paidToMerchantDate: -1, createdAt: -1 })
		.lean();

	const paymentRows = payments.map((payment) => {
		const transaction = payment.wiresheetTransactionId || {};
		const mapping =
			payment.merchantMappingId || transaction.merchantMappingId || {};

		const bank =
			mapping.acquirerId?.name || payment.paymentBank || "Unknown Bank";

		return {
			type: "payment",
			bank,
			receivedCurrency:
				transaction.processingCurrency ||
				payment.sourceProcessingCurrency ||
				"UNKNOWN",
			receivedAmount: toNumber(transaction.processingAmount),
			paidCurrency: getDisplayCurrency(
				payment.settlementCurrency,
				payment.paymentMethod,
			),
			paidAmount: toNumber(payment.amountPaid),
			settlementAmount: toNumber(payment.settlementAmount),
			balance: toNumber(transaction.balance),
			status: transaction.status || "settled",
			paymentCategory: "settlement",
			paymentCategoryLabel: "Settlement",
		};
	});

	const miscMatch = paymentDate
		? { paymentSheetDate: getDateRange(paymentDate) }
		: {};

	const miscPayments = await MiscellaneousPayment.find(miscMatch)
		.populate({
			path: "merchantMappingId",
			select:
				"mid acquirerId processingCurrency settlementCurrency paymentMethod",
			populate: { path: "acquirerId", select: "name" },
		})
		.sort({ paymentSheetDate: -1, createdAt: -1 })
		.lean();

	const miscRows = miscPayments.map((entry) => {
		const mapping = entry.merchantMappingId || {};

		return {
			type: "miscellaneous",
			bank: mapping.acquirerId?.name || entry.bankLabel || "Unknown Bank",
			receivedCurrency: entry.processingCurrency || "UNKNOWN",
			receivedAmount: 0,
			paidCurrency: getDisplayCurrency(
				entry.settlementCurrency,
				entry.paymentMethod,
			),
			paidAmount: toNumber(entry.amountPaid),
			settlementAmount: toNumber(entry.settlementAmount),
			balance: 0,
			status: "settled",
			paymentCategory: entry.entryType,
			paymentCategoryLabel: miscLabels[entry.entryType] || "Other",
		};
	});

	return [...paymentRows, ...miscRows].filter((row) => {
		if (acquirer && row.bank !== acquirer) return false;
		return true;
	});
};

export const getReportDates = async (_req, res) => {
	const dates = await Payment.aggregate([
		{ $match: { paidToMerchantDate: { $ne: null } } },
		{
			$group: {
				_id: {
					$dateToString: {
						format: "%Y-%m-%d",
						date: "$paidToMerchantDate",
					},
				},
			},
		},
		{ $sort: { _id: -1 } },
		{ $limit: 10 },
	]);

	return res.json({
		success: true,
		data: dates.map((item) => item._id),
	});
};

const buildBankReportData = async (filters) => {
	const rows = await getLedgerRowsDirect(filters);
	const bankMap = new Map();

	for (const row of rows) {
		const bank = row.bank;

		if (!bankMap.has(bank)) {
			bankMap.set(bank, {
				bank,
				received: {},
				paid: {},
				settlement: {},
				settlementTotal: 0,
				miscellaneous: {},
				miscellaneousTotal: 0,
				totalReceived: 0,
				totalPaid: 0,
				totalSettlementAmount: 0,
				totalBalance: 0,
				transactionCount: 0,
				statusCounts: {
					pending: 0,
					partially_paid: 0,
					settled: 0,
				},
			});
		}

		const item = bankMap.get(bank);

		item.received[row.receivedCurrency] =
			toNumber(item.received[row.receivedCurrency]) + row.receivedAmount;

		item.paid[row.paidCurrency] =
			toNumber(item.paid[row.paidCurrency]) + row.paidAmount;

		item.settlement[row.paidCurrency] =
			toNumber(item.settlement[row.paidCurrency]) + row.settlementAmount;

		item.totalReceived += row.receivedAmount;
		item.totalPaid += row.paidAmount;
		item.totalSettlementAmount += row.settlementAmount;
		item.totalBalance += row.balance;
		item.transactionCount += 1;

		if (row.paymentCategory === "settlement") {
			item.settlementTotal += row.settlementAmount;
		} else {
			const label = row.paymentCategoryLabel || "Other";

			item.miscellaneous[label] =
				toNumber(item.miscellaneous[label]) + row.settlementAmount;

			item.miscellaneousTotal += row.settlementAmount;
		}

		if (row.status === "settled") item.statusCounts.settled += 1;
		else if (row.status === "partially_paid")
			item.statusCounts.partially_paid += 1;
		else item.statusCounts.pending += 1;
	}

	return [...bankMap.values()];
};

export const getBankReports = async (req, res) => {
	const data = await buildBankReportData(req.query);

	return res.json({
		success: true,
		data,
	});
};

export const getPaymentDayReport = async (req, res) => {
	const rows = await getLedgerRowsDirect(req.query);

	const payments = rows.filter((row) => row.type === "payment");

	const miscellaneous = rows.filter((row) => row.type === "miscellaneous");

	const summary = {
		received: {},
		paid: {},
		settlement: {},
		miscellaneous: {},

		totalReceived: 0,
		totalPaid: 0,
		totalSettlementAmount: 0,
		totalMiscellaneous: 0,
		grandTotal: 0,
	};

	for (const row of rows) {
		summary.received[row.receivedCurrency] =
			toNumber(summary.received[row.receivedCurrency]) + row.receivedAmount;

		summary.paid[row.paidCurrency] =
			toNumber(summary.paid[row.paidCurrency]) + row.paidAmount;

		summary.settlement[row.paidCurrency] =
			toNumber(summary.settlement[row.paidCurrency]) + row.settlementAmount;

		summary.totalReceived += row.receivedAmount;
		summary.totalPaid += row.paidAmount;
		summary.totalSettlementAmount += row.settlementAmount;

		if (row.type === "miscellaneous") {
			const label = row.paymentCategoryLabel || "Other";

			summary.miscellaneous[label] =
				toNumber(summary.miscellaneous[label]) + row.settlementAmount;

			summary.totalMiscellaneous += row.settlementAmount;
		}
	}

	summary.grandTotal =
		summary.totalSettlementAmount + summary.totalMiscellaneous;

	return res.json({
		success: true,
		data: {
			paymentDate: req.query.paymentDate || null,

			payments,

			miscellaneous,

			summary,
		},
	});
};

export const exportBankReportsExcel = async (req, res) => {
	const data = await buildBankReportData(req.query);

	const worksheet = xlsx.utils.json_to_sheet(
		data.map((item) => ({
			Bank: item.bank,
			"Received By Currency": JSON.stringify(item.received),
			"Paid By Currency": JSON.stringify(item.paid),
			"Settlement By Currency": JSON.stringify(item.settlement),
			"Settlement Total": item.settlementTotal,
			Miscellaneous: JSON.stringify(item.miscellaneous),
			"Miscellaneous Total": item.miscellaneousTotal,
			"Total Received": item.totalReceived,
			"Total Paid": item.totalPaid,
			"Total Settlement Amount": item.totalSettlementAmount,
			"Total Balance": item.totalBalance,
			Transactions: item.transactionCount,
			Pending: item.statusCounts.pending,
			"Partially Paid": item.statusCounts.partially_paid,
			Settled: item.statusCounts.settled,
		})),
	);

	const workbook = xlsx.utils.book_new();
	xlsx.utils.book_append_sheet(workbook, worksheet, "Bank Report");

	const buffer = xlsx.write(workbook, {
		type: "buffer",
		bookType: "xlsx",
	});

	res.setHeader(
		"Content-Disposition",
		"attachment; filename=bank-settlement-report.xlsx",
	);
	res.setHeader(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	);

	return res.send(buffer);
};

export const exportBankReportsPdf = async (req, res) => {
	const data = await buildBankReportData(req.query);

	const doc = new PDFDocument({
		margin: 36,
		size: "A4",
		layout: "landscape",
	});

	res.setHeader(
		"Content-Disposition",
		"attachment; filename=bank-settlement-report.pdf",
	);
	res.setHeader("Content-Type", "application/pdf");

	doc.pipe(res);

	doc.fontSize(18).text("Bank Settlement Report", { align: "center" });
	doc.moveDown(0.4);

	doc.fontSize(9).text(`Payment Date: ${req.query.paymentDate || "All"}`, {
		align: "center",
	});

	doc.moveDown(1);

	const formatCurrencyObject = (obj) =>
		Object.entries(obj)
			.map(
				([currency, amount]) => `${currency}: ${toNumber(amount).toFixed(2)}`,
			)
			.join("\n") || "-";

	const columns = [
		{ label: "Bank", x: 36, width: 115 },
		{ label: "Received", x: 151, width: 120 },
		{ label: "Paid", x: 271, width: 120 },
		{ label: "Settlement", x: 391, width: 120 },
		{ label: "Misc.", x: 511, width: 110 },
		{ label: "Balance", x: 621, width: 80 },
		{ label: "Status", x: 701, width: 90 },
	];

	let y = doc.y;

	const drawHeader = () => {
		doc.font("Helvetica-Bold").fontSize(8);
		doc.rect(36, y, 755, 24).stroke();

		columns.forEach((column) => {
			doc.text(column.label, column.x + 4, y + 8, {
				width: column.width - 8,
			});
		});

		y += 24;
		doc.font("Helvetica").fontSize(8);
	};

	drawHeader();

	data.forEach((item) => {
		const receivedText = formatCurrencyObject(item.received);
		const paidText = formatCurrencyObject(item.paid);
		const settlementText = formatCurrencyObject(item.settlement);
		const miscText = formatCurrencyObject(item.miscellaneous);
		const statusText = `P: ${item.statusCounts.pending}\nPP: ${item.statusCounts.partially_paid}\nS: ${item.statusCounts.settled}`;

		const rowHeight =
			Math.max(
				doc.heightOfString(item.bank, { width: 107 }),
				doc.heightOfString(receivedText, { width: 112 }),
				doc.heightOfString(paidText, { width: 112 }),
				doc.heightOfString(settlementText, { width: 112 }),
				doc.heightOfString(miscText, { width: 102 }),
				doc.heightOfString(statusText, { width: 82 }),
				50,
			) + 10;

		if (y + rowHeight > doc.page.height - 36) {
			doc.addPage();
			y = 36;
			drawHeader();
		}

		doc.rect(36, y, 755, rowHeight).stroke();

		doc.text(item.bank, columns[0].x + 4, y + 6, {
			width: columns[0].width - 8,
		});

		doc.text(receivedText, columns[1].x + 4, y + 6, {
			width: columns[1].width - 8,
		});

		doc.text(paidText, columns[2].x + 4, y + 6, {
			width: columns[2].width - 8,
		});

		doc.text(settlementText, columns[3].x + 4, y + 6, {
			width: columns[3].width - 8,
		});

		doc.text(miscText, columns[4].x + 4, y + 6, {
			width: columns[4].width - 8,
		});

		doc.text(toNumber(item.totalBalance).toFixed(2), columns[5].x + 4, y + 6, {
			width: columns[5].width - 8,
		});

		doc.text(statusText, columns[6].x + 4, y + 6, {
			width: columns[6].width - 8,
		});

		y += rowHeight;
	});

	return doc.end();
};
