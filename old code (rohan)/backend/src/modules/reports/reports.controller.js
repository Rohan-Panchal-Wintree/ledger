import PDFDocument from "pdfkit";
import xlsx from "xlsx";
import { SettlementBatch } from "../batches/batch.model.js";

export const getSummaryReport = async (_req, res) => {
  const summary = await SettlementBatch.aggregate([
    {
      $group: {
        _id: null,
        totalPayable: { $sum: "$totalPayable" },
        totalPaid: { $sum: "$totalPaid" },
        totalBalance: { $sum: "$totalBalance" },
        totalBatches: { $sum: 1 }
      }
    }
  ]);

  res.json({ success: true, data: summary[0] || {} });
};

export const exportExcelReport = async (_req, res) => {
  const batches = await SettlementBatch.find().populate("acquirerId", "name").lean();
  const worksheet = xlsx.utils.json_to_sheet(
    batches.map((batch) => ({
      Batch: batch.batchName,
      Acquirer: batch.acquirerId?.name,
      "Start Date": batch.startDate,
      "End Date": batch.endDate,
      Payable: batch.totalPayable,
      Paid: batch.totalPaid,
      Balance: batch.totalBalance,
      Status: batch.status
    }))
  );
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Summary");
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", "attachment; filename=settlement-summary.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};

export const exportPdfReport = async (_req, res) => {
  const batches = await SettlementBatch.find().populate("acquirerId", "name").lean();
  const doc = new PDFDocument({ margin: 32 });

  res.setHeader("Content-Disposition", "attachment; filename=settlement-summary.pdf");
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.fontSize(18).text("Settlement Summary Report");
  doc.moveDown();

  batches.forEach((batch) => {
    doc
      .fontSize(11)
      .text(
        `${batch.batchName} | ${batch.acquirerId?.name || "N/A"} | Payable ${batch.totalPayable} | Paid ${batch.totalPaid} | Balance ${batch.totalBalance} | ${batch.status}`
      );
  });

  doc.end();
};
