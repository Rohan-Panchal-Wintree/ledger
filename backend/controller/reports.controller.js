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
  const { paymentDate } = req.query;

  const paymentMatch = paymentDate
    ? {
        paidToMerchantDate: getDateRange(paymentDate),
      }
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
    paymentDate
      ? {
          paymentSheetDate: getDateRange(paymentDate),
        }
      : {},
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
        merchantName: payment.merchantName,
        mid: payment.sourceMid,

        received: {},
        paidAgainstProcessing: {},
        settlement: {},

        transactions: [],
      };

      bankItem.merchants.push(merchant);
    }

    const processingCurrency = payment.sourceProcessingCurrency || "UNKNOWN";

    const settlementCurrency = payment.settlementCurrency || "UNKNOWN";

    const receivedAmount = toNumber(
      payment.wiresheetTransactionId?.processingAmount,
    );

    const paidAmount = toNumber(payment.amountPaid);

    const settlementAmount = toNumber(payment.settlementAmount);

    /*
		 |--------------------------------------------------------------------------
		 | RECEIVED
		 |--------------------------------------------------------------------------
		 */

    merchant.received[processingCurrency] =
      toNumber(merchant.received[processingCurrency]) + receivedAmount;

    bankItem.summary.received[processingCurrency] =
      toNumber(bankItem.summary.received[processingCurrency]) + receivedAmount;

    summary.received[processingCurrency] =
      toNumber(summary.received[processingCurrency]) + receivedAmount;

    summary.totalReceived += receivedAmount;

    /*
		 |--------------------------------------------------------------------------
		 | PAID AGAINST PROCESSING
		 |--------------------------------------------------------------------------
		 */

    merchant.paidAgainstProcessing[processingCurrency] =
      toNumber(merchant.paidAgainstProcessing[processingCurrency]) + paidAmount;

    bankItem.summary.paidAgainstProcessing[processingCurrency] =
      toNumber(bankItem.summary.paidAgainstProcessing[processingCurrency]) +
      paidAmount;

    summary.paidAgainstProcessing[processingCurrency] =
      toNumber(summary.paidAgainstProcessing[processingCurrency]) + paidAmount;

    summary.totalPaidAgainstProcessing += paidAmount;

    /*
		 |--------------------------------------------------------------------------
		 | SETTLEMENT
		 |--------------------------------------------------------------------------
		 */

    merchant.settlement[settlementCurrency] =
      toNumber(merchant.settlement[settlementCurrency]) + settlementAmount;

    bankItem.summary.settlement[settlementCurrency] =
      toNumber(bankItem.summary.settlement[settlementCurrency]) +
      settlementAmount;

    summary.settlement[settlementCurrency] =
      toNumber(summary.settlement[settlementCurrency]) + settlementAmount;

    summary.totalSettlement += settlementAmount;

    merchant.transactions.push({
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

      paymentMethod: payment.paymentMethod,

      paymentDate: payment.paymentDate,
      paidToMerchantDate: payment.paidToMerchantDate,

      status: payment.wiresheetTransactionId?.status || "settled",
    });
  }

  /*
	 |--------------------------------------------------------------------------
	 | MISCELLANEOUS
	 |--------------------------------------------------------------------------
	 */

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

    const bankItem = bankMap.get(bank);

    const label = miscLabels[misc.entryType] || "Other";

    const amount = toNumber(misc.settlementAmount);

    bankItem.summary.miscellaneous[label] =
      toNumber(bankItem.summary.miscellaneous[label]) + amount;

    summary.miscellaneous[label] =
      toNumber(summary.miscellaneous[label]) + amount;

    summary.totalMiscellaneous += amount;
  }

  return res.json({
    success: true,

    data: {
      paymentDate: paymentDate || null,

      summary,

      banks: [...bankMap.values()],
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
