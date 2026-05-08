import { Merchant } from "../models/merchant.model.js";
import { MerchantAccount } from "../models/merchant-account.model.js";
import { MiscellaneousPayment } from "../models/miscellaneous-payment.model.js";

const entryTypeLabels = {
	repayment: "Repayment",
	bank_rr: "Bank RR",
	rr: "Cap RR",
	agent: "Agent",
	overcapped_rr_refund: "Overcapped RR Refund",
	chb_refund: "CHB Refund",
	adjustment: "Adjustment",
	other: "Other",
};

const formatPaymentSheetDateLabel = (value) => {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return `${String(date.getUTCDate()).padStart(2, "0")}.${String(
		date.getUTCMonth() + 1,
	).padStart(2, "0")}`;
};

const normalizeOptionalDate = (value) => {
	if (!value) return undefined;

	const date = new Date(value);

	return Number.isNaN(date.getTime()) ? undefined : date;
};

const resolveMerchantTag = (merchantName) =>
	String(merchantName || "")
		.toUpperCase()
		.includes("(DP)")
		? "Dreamzpay Merchant"
		: "Transactworld Merchant";

const normalizeNumber = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const withDisplayFields = (entry) => ({
	...entry,
	entryTypeLabel: entryTypeLabels[entry.entryType] || "Other",
	merchantDisplayName:
		entry.merchantId?.merchantName || entry.merchantName || "",
	acquirerDisplayName: entry.merchantMappingId?.acquirerId?.name || "",
	linkedMid: entry.merchantMappingId?.mid || entry.mid || "",
});

const normalizePayload = async (payload) => {
	const merchant = await Merchant.findById(payload.merchantId).lean();

	if (!merchant) {
		return {
			error: {
				status: 404,
				message: "Merchant not found",
			},
		};
	}

	let merchantMapping = null;

	if (payload.merchantMappingId) {
		merchantMapping = await MerchantAccount.findById(payload.merchantMappingId)
			.populate("acquirerId", "name")
			.lean();

		if (!merchantMapping) {
			return {
				error: {
					status: 404,
					message: "Merchant mapping not found",
				},
			};
		}

		if (String(merchantMapping.merchantId) !== String(payload.merchantId)) {
			return {
				error: {
					status: 400,
					message: "Selected MID does not belong to the merchant",
				},
			};
		}
	}

	const paymentSheetDate = new Date(payload.paymentSheetDate);

	if (Number.isNaN(paymentSheetDate.getTime())) {
		return {
			error: {
				status: 400,
				message: "Invalid payment sheet date",
			},
		};
	}

	return {
		data: {
			entryType: payload.entryType,
			paymentSheetDate,
			paymentSheetDateLabel: formatPaymentSheetDateLabel(paymentSheetDate),
			bankLabel: String(payload.bankLabel || "").trim(),

			merchantId: merchant._id,
			merchantName: merchant.merchantName,

			merchantMappingId: merchantMapping?._id || null,
			mid:
				merchantMapping?.mid || String(payload.mid || "").trim() || undefined,

			startDate: normalizeOptionalDate(payload.startDate),
			endDate: normalizeOptionalDate(payload.endDate),

			processingCurrency:
				String(payload.processingCurrency || "")
					.trim()
					.toUpperCase() ||
				merchantMapping?.processingCurrency ||
				undefined,

			amountPaid: normalizeNumber(payload.amountPaid),
			rate: normalizeNumber(payload.rate),

			settlementCurrency:
				String(payload.settlementCurrency || "")
					.trim()
					.toUpperCase() || merchantMapping?.settlementCurrency,

			settlementAmount: normalizeNumber(payload.settlementAmount),
			notes: String(payload.notes || "").trim() || undefined,
		},
	};
};

export const listMiscellaneousPayments = async (_req, res) => {
	const entries = await MiscellaneousPayment.find()
		.populate("merchantId", "merchantName")
		.populate({
			path: "merchantMappingId",
			select: "mid processingCurrency settlementCurrency acquirerId",
			populate: {
				path: "acquirerId",
				select: "name",
			},
		})
		.sort({ paymentSheetDate: -1, createdAt: -1 })
		.lean();

	return res.json({
		success: true,
		data: entries.map(withDisplayFields),
	});
};

export const getMiscellaneousPayment = async (req, res) => {
	const entry = await MiscellaneousPayment.findById(req.params.id)
		.populate("merchantId", "merchantName")
		.populate({
			path: "merchantMappingId",
			select: "mid processingCurrency settlementCurrency acquirerId",
			populate: {
				path: "acquirerId",
				select: "name",
			},
		})
		.lean();

	if (!entry) {
		return res.status(404).json({
			success: false,
			message: "Miscellaneous payment not found",
		});
	}

	return res.json({
		success: true,
		data: withDisplayFields(entry),
	});
};

export const createMiscellaneousPayment = async (req, res) => {
	const payload = { ...req.body };

	let merchant = null;

	if (payload.merchantId) {
		merchant = await Merchant.findById(payload.merchantId);

		if (!merchant) {
			return res.status(404).json({
				success: false,
				message: "Merchant not found",
			});
		}
	} else {
		const merchantName = payload.merchantName.trim();

		merchant = await Merchant.findOne({ merchantName }).lean();

		if (!merchant) {
			try {
				merchant = await Merchant.create({
					merchantName,
					merchantTag: resolveMerchantTag(merchantName),
					status: "active",
				});
			} catch (error) {
				if (error.code === 11000) {
					merchant = await Merchant.findOne({ merchantName }).lean();
				} else {
					throw error;
				}
			}
		}
	}

	let merchantMappingId = payload.merchantMappingId || null;

	if (!merchantMappingId && payload.mid) {
		const mapping = await MerchantAccount.findOne({
			merchantId: merchant._id,
			mid: String(payload.mid).trim(),
		}).lean();

		if (mapping) {
			merchantMappingId = mapping._id;
		}
	}

	const paymentSheetDate = new Date(payload.paymentSheetDate);

	const data = await MiscellaneousPayment.create({
		entryType: payload.entryType,
		paymentSheetDate,
		paymentSheetDateLabel:
			payload.paymentSheetDateLabel ||
			`${String(paymentSheetDate.getUTCDate()).padStart(2, "0")}.${String(
				paymentSheetDate.getUTCMonth() + 1,
			).padStart(2, "0")}`,

		bankLabel: payload.bankLabel,

		merchantId: merchant._id,
		merchantName: merchant.merchantName,
		merchantMappingId,

		mid: payload.mid,
		startDate: payload.startDate ? new Date(payload.startDate) : undefined,
		endDate: payload.endDate ? new Date(payload.endDate) : undefined,

		processingCurrency: payload.processingCurrency,
		amountPaid: payload.amountPaid,
		rate: payload.rate || 0,
		settlementCurrency: payload.settlementCurrency,
		settlementAmount: payload.settlementAmount,

		notes: payload.notes,
		createdBy: req.user._id,
	});

	return res.status(201).json({
		success: true,
		data,
	});
};

export const updateMiscellaneousPayment = async (req, res) => {
	const existingEntry = await MiscellaneousPayment.findById(
		req.params.id,
	).lean();

	if (!existingEntry) {
		return res.status(404).json({
			success: false,
			message: "Miscellaneous payment not found",
		});
	}

	const normalized = await normalizePayload({
		...existingEntry,
		...req.body,
		merchantId: req.body.merchantId || existingEntry.merchantId?.toString(),
		merchantMappingId:
			req.body.merchantMappingId || existingEntry.merchantMappingId?.toString(),
	});

	if (normalized.error) {
		return res.status(normalized.error.status).json({
			success: false,
			message: normalized.error.message,
		});
	}

	const updatedEntry = await MiscellaneousPayment.findByIdAndUpdate(
		req.params.id,
		normalized.data,
		{
			new: true,
			runValidators: true,
		},
	)
		.populate("merchantId", "merchantName")
		.populate({
			path: "merchantMappingId",
			select: "mid processingCurrency settlementCurrency acquirerId",
			populate: {
				path: "acquirerId",
				select: "name",
			},
		})
		.lean();

	return res.json({
		success: true,
		data: withDisplayFields(updatedEntry),
	});
};

export const deleteMiscellaneousPayment = async (req, res) => {
	const entry = await MiscellaneousPayment.findByIdAndDelete(req.params.id);

	if (!entry) {
		return res.status(404).json({
			success: false,
			message: "Miscellaneous payment not found",
		});
	}

	return res.json({
		success: true,
		message: "Miscellaneous payment deleted successfully",
	});
};
