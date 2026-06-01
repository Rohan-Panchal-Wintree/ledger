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

export const getReportDates = async (_req, res) => {
	const today = new Date();

	const dates = await Payment.aggregate([
		{
			$match: {
				paidToMerchantDate: {
					$lte: today,
				},
			},
		},

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

		{
			$sort: {
				_id: -1,
			},
		},

		{
			$limit: 5,
		},
	]);

	return res.json({
		success: true,
		data: dates.map((item) => item._id),
	});
};

export const getPaymentDayReport = async (req, res) => {
	const data = await buildPaymentDayReportData(req.query);

	return res.json({
		success: true,
		data,
	});
};

const buildPaymentDayReportData = async ({ paymentDate }) => {
	const paymentMatch = paymentDate
		? { paidToMerchantDate: getDateRange(paymentDate) }
		: {};

	const payments = await Payment.find(paymentMatch)
		.populate({
			path: "wiresheetTransactionId",
			select:
				"processingAmount processingCurrency startDate endDate balance status",
		})
		.sort({
			paymentBank: 1,
			merchantName: 1,
			sourceMid: 1,
		})
		.lean();

	const miscPayments = await MiscellaneousPayment.find(
		paymentDate ? { paymentSheetDate: getDateRange(paymentDate) } : {},
	).lean();

	const bankMap = new Map();

	const summary = {
		received: {},
		paidAgainstProcessing: {},
		settlement: {},
		miscellaneous: {},
		totalReceived: 0,
		totalPaidAgainstProcessing: 0,
		totalSettlement: 0,
		totalMiscellaneous: 0,
	};

	const add = (obj, key, amount) => {
		const currency = key || "UNKNOWN";
		obj[currency] = toNumber(obj[currency]) + toNumber(amount);
	};

	for (const payment of payments) {
		const bank = payment.paymentBank || "Unknown Bank";

		if (!bankMap.has(bank)) {
			bankMap.set(bank, {
				bank,
				summary: {
					received: {},
					paidAgainstProcessing: {},
					settlement: {},
					miscellaneous: {},
				},
				merchants: [],
			});
		}

		const bankItem = bankMap.get(bank);

		let merchant = bankItem.merchants.find(
			(item) =>
				item.merchantName === payment.merchantName &&
				item.mid === payment.sourceMid,
		);

		if (!merchant) {
			merchant = {
				merchantName: payment.merchantName || "Unknown Merchant",
				mid: payment.sourceMid || "-",
				received: {},
				paidAgainstProcessing: {},
				settlement: {},
				settlementRates: {},
				paymentMethods: {},
				transactions: [],
			};

			bankItem.merchants.push(merchant);
		}

		const processingCurrency = payment.sourceProcessingCurrency || "UNKNOWN";
		const settlementCurrency = getDisplayCurrency(
			payment.settlementCurrency,
			payment.paymentMethod,
		);

		const receivedAmount = toNumber(
			payment.wiresheetTransactionId?.processingAmount,
		);
		const paidAmount = toNumber(payment.amountPaid);
		const settlementAmount = toNumber(payment.settlementAmount);
		const paymentRate = toNumber(payment.paymentRate);

		add(merchant.received, processingCurrency, receivedAmount);
		add(bankItem.summary.received, processingCurrency, receivedAmount);
		add(summary.received, processingCurrency, receivedAmount);
		summary.totalReceived += receivedAmount;

		add(merchant.paidAgainstProcessing, processingCurrency, paidAmount);
		add(bankItem.summary.paidAgainstProcessing, processingCurrency, paidAmount);
		add(summary.paidAgainstProcessing, processingCurrency, paidAmount);
		summary.totalPaidAgainstProcessing += paidAmount;

		add(merchant.settlement, settlementCurrency, settlementAmount);
		add(bankItem.summary.settlement, settlementCurrency, settlementAmount);
		add(summary.settlement, settlementCurrency, settlementAmount);
		summary.totalSettlement += settlementAmount;

		const rateKey = `${processingCurrency}_${settlementCurrency}`;
		if (paymentRate) merchant.settlementRates[rateKey] = paymentRate;

		merchant.paymentMethods[settlementCurrency] =
			payment.paymentMethod || "UNKNOWN";

		merchant.transactions.push({
			bank,
			merchantName: payment.merchantName,
			mid: payment.sourceMid,
			receivedPeriod: {
				startDate: payment.sourceStartDate,
				endDate: payment.sourceEndDate,
			},
			receivedCurrency: processingCurrency,
			receivedAmount,
			paidCurrency: processingCurrency,
			paidAmount,
			settlementCurrency,
			settlementAmount,
			paymentRate,
			paymentMethod: payment.paymentMethod,
			paymentDate: payment.paymentDate,
			paidToMerchantDate: payment.paidToMerchantDate,
			status: payment.wiresheetTransactionId?.status || "settled",
		});
	}

	for (const misc of miscPayments) {
		const bank = misc.bankLabel || "Unknown Bank";

		if (!bankMap.has(bank)) {
			bankMap.set(bank, {
				bank,
				summary: {
					received: {},
					paidAgainstProcessing: {},
					settlement: {},
					miscellaneous: {},
				},
				merchants: [],
			});
		}

		const label = miscLabels[misc.entryType] || "Other";
		const amount = toNumber(misc.settlementAmount);

		add(bankMap.get(bank).summary.miscellaneous, label, amount);
		add(summary.miscellaneous, label, amount);
		summary.totalMiscellaneous += amount;
	}

	return {
		paymentDate: paymentDate || null,
		summary,
		banks: [...bankMap.values()],
	};
};

export const exportBankReportsExcel = async (req, res) => {
	const report = await buildPaymentDayReportData(req.query);

	const rows = [];

	for (const bank of report.banks || []) {
		for (const merchant of bank.merchants || []) {
			for (const transaction of merchant.transactions || []) {
				rows.push({
					"Payment Date": report.paymentDate || "All",
					Bank: bank.bank,
					Merchant: merchant.merchantName,
					MID: merchant.mid,

					"Start Date": transaction.receivedPeriod?.startDate,
					"End Date": transaction.receivedPeriod?.endDate,

					"Received Currency": transaction.receivedCurrency,
					"Received Amount": transaction.receivedAmount,

					"Paid Currency": transaction.paidCurrency,
					"Paid Against Processing": transaction.paidAmount,

					"Settlement Currency": transaction.settlementCurrency,
					"Settlement Amount": transaction.settlementAmount,

					Rate: transaction.paymentRate || 0,

					"Payment Method": transaction.paymentMethod,
					"Paid Date": transaction.paidToMerchantDate,
					Status: transaction.status,
				});
			}
		}
	}

	const worksheet = xlsx.utils.json_to_sheet(rows);
	const workbook = xlsx.utils.book_new();

	xlsx.utils.book_append_sheet(workbook, worksheet, "Payment Report");

	const buffer = xlsx.write(workbook, {
		type: "buffer",
		bookType: "xlsx",
	});

	res.setHeader(
		"Content-Disposition",
		`attachment; filename=payment-report-${req.query.paymentDate || "all"}.xlsx`,
	);
	res.setHeader(
		"Content-Type",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	);

	return res.send(buffer);
};

// ─────────────────────────────────────────────────────────────────────────────
// ─── PROFESSIONAL PDF EXPORT ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const exportBankReportsPdf = async (req, res) => {
	const report = await buildPaymentDayReportData(req.query);

	const doc = new PDFDocument({
		margin: 0,
		size: "A4",
		layout: "landscape",
		bufferPages: true,
		info: {
			Title: "Payment Settlement Report",
			Author: "Ledger Settlement System",
			Subject: `Payment Date: ${report.paymentDate || "All"}`,
			Creator: "Node.js PDFKit",
		},
	});

	res.setHeader(
		"Content-Disposition",
		`attachment; filename=payment-report-${req.query.paymentDate || "all"}.pdf`,
	);
	res.setHeader("Content-Type", "application/pdf");

	doc.pipe(res);

	// ─── Color Palette ───────────────────────────────────────────────────────
	const C = {
		primary: "#173B57",
		primaryLight: "#2E5F8A",
		accent: "#2E86AB",
		light: "#F3F6FA",
		border: "#D6DEE8",
		darkBorder: "#A8C4D8",
		text: "#111827",
		muted: "#6B7280",
		rowAlt: "#FAFBFC",
		white: "#FFFFFF",
		gray: "#F9FAFB",
	};

	// ─── Dimensions ──────────────────────────────────────────────────────────
	const A4_W = 841.89;
	const A4_H = 595.28;
	const MARGIN = 24;
	const USABLE = A4_W - MARGIN * 2;
	const FOOTER_H = 30;
	const CONTENT_END = A4_H - MARGIN - FOOTER_H;

	// ─── Formatters ──────────────────────────────────────────────────────────
	const money = (value) =>
		Number(value || 0).toLocaleString("en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});

	const currencyText = (obj = {}) => {
		const parts = Object.entries(obj)
			.filter(([, amount]) => Number(amount))
			.map(([currency, amount]) => `${currency} ${money(amount)}`);
		return parts.length ? parts.join(" | ") : "—";
	};

	const merchantSettlementText = (merchant) => {
		const parts = Object.entries(merchant.settlement || {})
			.filter(([, amount]) => Number(amount))
			.map(([currency, amount]) => {
				const rateEntry = Object.entries(merchant.settlementRates || {}).find(
					([key]) => key.endsWith(`_${currency}`),
				);
				const rate = rateEntry?.[1] ? ` @ ${rateEntry[1]}` : "";
				return `${currency} ${money(amount)}${rate}`;
			});
		return parts.length ? parts.join(" | ") : "—";
	};

	// ─── Round rectangle helper ──────────────────────────────────────────────
	const roundRect = (x, y, w, h, r, fill, stroke) => {
		doc.save();
		doc
			.moveTo(x + r, y)
			.lineTo(x + w - r, y)
			.quadraticCurveTo(x + w, y, x + w, y + r)
			.lineTo(x + w, y + h - r)
			.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
			.lineTo(x + r, y + h)
			.quadraticCurveTo(x, y + h, x, y + h - r)
			.lineTo(x, y + r)
			.quadraticCurveTo(x, y, x + r, y)
			.closePath();

		if (fill && stroke) doc.fillAndStroke(fill, stroke);
		else if (fill) doc.fill(fill);
		else if (stroke) doc.stroke(stroke);

		doc.restore();
	};

	// ─── Page break detection ────────────────────────────────────────────────
	const needsPageBreak = (requiredSpace) => {
		return doc.y + requiredSpace > CONTENT_END;
	};

	const forcePageBreak = () => {
		doc.addPage();
		doc.y = MARGIN;
	};

	// ─── Header (first page only) ────────────────────────────────────────────
	const drawHeader = () => {
		const y = MARGIN;
		const H = 52;

		roundRect(MARGIN, y, USABLE, H, 6, C.primary, null);

		doc.rect(MARGIN, y, 5, H).fill(C.accent);

		doc
			.font("Helvetica-Bold")
			.fontSize(18)
			.fillColor(C.white)
			.text("PAYMENT SETTLEMENT REPORT", MARGIN + 16, y + 10, {
				width: USABLE * 0.65,
				lineBreak: false,
			});

		const paymentDateStr = report.paymentDate
			? new Date(report.paymentDate).toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				})
			: "All Dates";

		const generatedStr = new Date()
			.toISOString()
			.slice(0, 19)
			.replace("T", " ");

		doc
			.font("Helvetica")
			.fontSize(7.5)
			.fillColor(C.darkBorder)
			.text(`Payment Date: ${paymentDateStr}`, MARGIN + 16, y + 32, {
				lineBreak: false,
			})
			.fontSize(7.5)
			.text(`Generated: ${generatedStr} UTC`, MARGIN, y + 32, {
				width: USABLE - 8,
				align: "right",
				lineBreak: false,
			});

		doc.y = y + H + 14;
	};

	// ─── Summary KPI Cards ───────────────────────────────────────────────────
	const drawSummaryCards = (summary) => {
		if (needsPageBreak(75)) forcePageBreak();

		const GAP = 6;
		const CW = (USABLE - GAP * 3) / 4;
		const CH = 60;
		const y = doc.y;

		const cards = [
			{ label: "RECEIVED", value: currencyText(summary.received) },
			{
				label: "PAID AGAINST PROCESSING",
				value: currencyText(summary.paidAgainstProcessing),
			},
			{ label: "SETTLEMENT", value: currencyText(summary.settlement) },
			{
				label: "MISCELLANEOUS",
				value: currencyText(summary.miscellaneous),
			},
		];

		cards.forEach((card, i) => {
			const x = MARGIN + i * (CW + GAP);

			roundRect(x, y, CW, CH, 5, C.light, C.border);

			doc.rect(x, y, CW, 3).fill(C.primary);

			doc
				.font("Helvetica-Bold")
				.fontSize(6.5)
				.fillColor(C.muted)
				.text(card.label, x + 8, y + 9, {
					width: CW - 16,
					lineBreak: true,
				});

			doc
				.font("Helvetica-Bold")
				.fontSize(8.5)
				.fillColor(C.text)
				.text(card.value, x + 8, y + 24, {
					width: CW - 16,
					height: 28,
					lineBreak: true,
				});
		});

		doc.y = y + CH + 10;
	};

	// ─── Caption Note ───────────────────────────────────────────────────────
	const drawCaption = () => {
		if (needsPageBreak(16)) forcePageBreak();

		doc
			.font("Helvetica")
			.fontSize(7)
			.fillColor(C.muted)
			.text(
				"PDF shows bank and merchant-level totals only. Detailed transaction-level data is available in the Excel export.",
				MARGIN,
				doc.y,
				{ width: USABLE },
			);

		doc.y += 10;
	};

	// ─── Section Title ──────────────────────────────────────────────────────
	const drawSectionTitle = (title) => {
		if (needsPageBreak(26)) forcePageBreak();

		const y = doc.y;

		doc.rect(MARGIN, y, USABLE, 22).fillAndStroke(C.light, C.border);
		doc.rect(MARGIN, y, 4, 22).fill(C.accent);

		doc
			.font("Helvetica-Bold")
			.fontSize(10.5)
			.fillColor(C.primary)
			.text(title, MARGIN + 12, y + 4, {
				width: USABLE - 20,
				lineBreak: false,
			});

		doc.y = y + 26;
	};

	// ─── Bank Summary Card ──────────────────────────────────────────────────
	const drawBankCard = (bankSummary) => {
		if (needsPageBreak(56)) forcePageBreak();

		const H = 48;
		const y = doc.y;
		const QW = USABLE / 4;

		roundRect(MARGIN, y, USABLE, H, 4, C.white, C.border);

		const cols = [
			{ label: "Received", value: currencyText(bankSummary.received) },
			{
				label: "Paid Against Processing",
				value: currencyText(bankSummary.paidAgainstProcessing),
			},
			{ label: "Settlement", value: currencyText(bankSummary.settlement) },
			{
				label: "Miscellaneous",
				value: currencyText(bankSummary.miscellaneous),
			},
		];

		cols.forEach((col, i) => {
			const x = MARGIN + i * QW;

			if (i > 0) {
				doc
					.moveTo(x, y + 6)
					.lineTo(x, y + H - 6)
					.strokeColor(C.border)
					.lineWidth(0.5)
					.stroke();
			}

			doc
				.font("Helvetica-Bold")
				.fontSize(7.5)
				.fillColor(C.primary)
				.text(col.label, x + 8, y + 8, {
					width: QW - 14,
					lineBreak: false,
				});

			doc
				.font("Helvetica")
				.fontSize(7.5)
				.fillColor(C.text)
				.text(col.value, x + 8, y + 22, {
					width: QW - 14,
					height: 18,
					lineBreak: true,
				});
		});

		doc.y = y + H + 8;
	};

	// ─── Table Columns ──────────────────────────────────────────────────────
	const COLS = [
		{ label: "Merchant", width: Math.floor(USABLE * 0.24) },
		{ label: "MID", width: Math.floor(USABLE * 0.08) },
		{ label: "Received", width: Math.floor(USABLE * 0.19) },
		{ label: "Paid Against Processing", width: Math.floor(USABLE * 0.21) },
		{ label: "Settlement + Rate", width: 0 },
	];

	COLS[4].width =
		USABLE - COLS[0].width - COLS[1].width - COLS[2].width - COLS[3].width;

	let colX = MARGIN;
	for (const col of COLS) {
		col.x = colX;
		colX += col.width;
	}

	// ─── Table Header ───────────────────────────────────────────────────────
	const drawTableHeader = () => {
		if (needsPageBreak(24)) forcePageBreak();

		const y = doc.y;
		const H = 20;

		doc.rect(MARGIN, y, USABLE, H).fill(C.primary);

		doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.white);

		for (const col of COLS) {
			doc.text(col.label, col.x + 4, y + 5, {
				width: col.width - 8,
				lineBreak: true,
			});
		}

		doc.y = y + H;
	};

	// ─── Merchant Row ───────────────────────────────────────────────────────
	const drawMerchantRow = (merchant, index) => {
		const PAD = 4;
		const received = currencyText(merchant.received);
		const paid = currencyText(merchant.paidAgainstProcessing);
		const settlement = merchantSettlementText(merchant);

		// Calculate max row height
		const cellH = (text, width) =>
			doc.heightOfString(text || "—", {
				width: width - PAD * 2,
				fontSize: 7.5,
			}) +
			PAD * 2;

		const RH = Math.max(
			20,
			cellH(merchant.merchantName || "—", COLS[0].width),
			cellH(merchant.mid || "—", COLS[1].width),
			cellH(received, COLS[2].width),
			cellH(paid, COLS[3].width),
			cellH(settlement, COLS[4].width),
		);

		// Page break logic
		if (needsPageBreak(RH + 2)) {
			forcePageBreak();
			drawTableHeader();
		}

		const y = doc.y;
		const bg = index % 2 === 0 ? C.white : C.gray;

		doc.rect(MARGIN, y, USABLE, RH).fillAndStroke(bg, C.border);

		// Column dividers
		doc.strokeColor(C.border).lineWidth(0.4);
		let dX = MARGIN;
		for (let i = 0; i < COLS.length - 1; i++) {
			dX += COLS[i].width;
			doc
				.moveTo(dX, y)
				.lineTo(dX, y + RH)
				.stroke();
		}

		// Cell content
		doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.text);

		doc.text(merchant.merchantName || "—", COLS[0].x + PAD, y + PAD, {
			width: COLS[0].width - PAD * 2,
			lineBreak: true,
		});

		doc.font("Helvetica").fontSize(7.5).fillColor(C.text);

		doc
			.text(merchant.mid || "—", COLS[1].x + PAD, y + PAD, {
				width: COLS[1].width - PAD * 2,
			})
			.text(received, COLS[2].x + PAD, y + PAD, {
				width: COLS[2].width - PAD * 2,
			})
			.text(paid, COLS[3].x + PAD, y + PAD, {
				width: COLS[3].width - PAD * 2,
			})
			.text(settlement, COLS[4].x + PAD, y + PAD, {
				width: COLS[4].width - PAD * 2,
			});

		doc.y = y + RH;
	};

	// ─── Footer (on every page) ──────────────────────────────────────────────
	const addFooters = () => {
		const range = doc.bufferedPageRange();

		for (let i = range.start; i < range.start + range.count; i++) {
			doc.switchToPage(i);

			const y = A4_H - MARGIN + 4;

			// Line
			doc
				.moveTo(MARGIN, y)
				.lineTo(A4_W - MARGIN, y)
				.strokeColor(C.border)
				.lineWidth(0.4)
				.stroke();

			// Left text
			doc
				.font("Helvetica")
				.fontSize(7)
				.fillColor(C.muted)
				.text("CONFIDENTIAL — For internal use only", MARGIN, y + 6, {
					lineBreak: false,
				});

			// Right text (page number)
			doc.text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN, y + 6, {
				width: USABLE,
				align: "right",
				lineBreak: false,
			});
		}
	};

	// ─────────────────────────────────────────────────────────────────────────
	// ─── RENDER DOCUMENT ─────────────────────────────────────────────────────
	// ─────────────────────────────────────────────────────────────────────────

	drawHeader();
	drawSummaryCards(report.summary || {});
	drawCaption();

	// Draw each bank's section
	for (const bank of report.banks || []) {
		drawSectionTitle(`Bank: ${bank.bank || "Unknown Bank"}`);
		drawBankCard(bank.summary || {});
		drawTableHeader();

		(bank.merchants || []).forEach((merchant, index) => {
			drawMerchantRow(merchant, index);
		});

		doc.y += 8;
	}

	// Final totals section
	drawSectionTitle("Final Totals Summary");

	drawBankCard({
		received: report.summary.received,
		paidAgainstProcessing: report.summary.paidAgainstProcessing,
		settlement: report.summary.settlement,
		miscellaneous: report.summary.miscellaneous,
	});

	// Add footers to all pages
	addFooters();

	// Remove blank pages that might have been added
	const finalRange = doc.bufferedPageRange();
	if (finalRange.count > 0 && doc.y <= MARGIN) {
		// Last page is essentially blank, remove it
		doc._pageBuffer.pop();
	}

	doc.end();
};
