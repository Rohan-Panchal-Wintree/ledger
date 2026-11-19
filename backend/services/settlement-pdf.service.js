import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import PDFKit from "pdfkit";
import { settlementDownloadError } from "./acquirer-settlement.service.js";

const cents = (value) => {
	const amount = Number(value);
	const result = Math.round((amount + Number.EPSILON) * 100);
	if (!Number.isFinite(amount) || !Number.isSafeInteger(result)) {
		settlementDownloadError("Invalid settlement amount in PDF totals.");
	}
	return result;
};

export const getSettlementPayoutTotals = (conversions) => {
	const totals = new Map();
	for (const conversion of conversions) {
		const currency = conversion.settlementCurrency;
		if (!["EUR", "USDT"].includes(currency)) settlementDownloadError("Settlement currency must be EUR or USDT.");
		const total = (totals.get(currency) || 0) + cents(conversion.finalPayable);
		if (!Number.isSafeInteger(total)) settlementDownloadError("Settlement payout total is too large.");
		totals.set(currency, total);
	}
	return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, total]) => ({ currency, amount: total / 100 }));
};

const buildPayoutSummary = (report, included, registerFonts) => new Promise((resolve, reject) => {
	const doc = new PDFKit({ size: "A4", margin: 43, bufferPages: true });
	const chunks = [];
	doc.on("data", (chunk) => chunks.push(chunk));
	doc.on("end", () => resolve(Buffer.concat(chunks)));
	doc.on("error", reject);
	try {
		const fonts = registerFonts?.(doc) || { regular: "Helvetica", semiBold: "Helvetica-Bold" };
		const left = 43;
		const width = doc.page.width - left * 2;
		const money = (value) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		let y;
		const heading = (continued = false) => {
			doc.rect(left, 43, 32, 4).fill("#1234BC");
			doc.font(fonts.semiBold).fontSize(19).fillColor("#191C1E")
				.text("Final payable by settlement currency", left, 62, { width, lineGap: 2 });
			y = doc.y + 12;
			doc.font(fonts.regular).fontSize(9).fillColor("#647084")
				.text(`${report.merchantName} | MID ${report.memberId}${continued ? " | continued" : ""}`, left, y, { width });
			y = doc.y + 24;
		};
		const tableHeader = () => {
			doc.roundedRect(left, y, width, 30, 4).fill("#EEF2FF");
			doc.font(fonts.semiBold).fontSize(8).fillColor("#1234BC");
			doc.text("ACQUIRER", left + 12, y + 9, { width: width - 235 });
			doc.text("CURRENCY", left + width - 215, y + 9, { width: 75 });
			doc.text("FINAL PAYABLE", left + width - 136, y + 9, { width: 124, align: "right" });
			y += 30;
		};
		heading();
		if (included.length) tableHeader();
		for (const { part, conversion } of included) {
			doc.font(fonts.regular).fontSize(9);
			const rowHeight = Math.max(37, doc.heightOfString(part.acquirer, { width: width - 235 }) + 22);
			if (y + rowHeight > doc.page.height - 115) {
				doc.addPage(); heading(true); tableHeader();
			}
			doc.fillColor("#191C1E").text(part.acquirer, left + 12, y + 11, { width: width - 235 });
			doc.fillColor("#647084").text(conversion.settlementCurrency, left + width - 215, y + 11, { width: 75 });
			doc.font(fonts.semiBold).fillColor("#191C1E")
				.text(money(conversion.finalPayable), left + width - 136, y + 11, { width: 124, align: "right" });
			y += rowHeight;
			doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor("#D7DDE7").stroke();
		}
		const totals = getSettlementPayoutTotals(included.map(({ conversion }) => conversion));
		const totalHeight = Math.max(1, totals.length) * 70 + 65;
		if (y + totalHeight > doc.page.height - 100) { doc.addPage(); heading(true); }
		y += 25;
		if (!totals.length) {
			doc.font(fonts.regular).fontSize(10).fillColor("#647084")
				.text("No payable acquirer settlements in this report.", left, y, { width });
		} else {
			for (const total of totals) {
				doc.roundedRect(left, y, width, 58, 6).fill("#EDEFFD");
				doc.font(fonts.semiBold).fontSize(10).fillColor("#1234BC")
					.text(`TOTAL PAYABLE - ${total.currency}`, left + 15, y + 21, { width: width - 235 });
				doc.fontSize(18).text(money(total.amount), left + width - 220, y + 16, { width: 205, align: "right" });
				y += 70;
			}
			doc.font(fonts.regular).fontSize(8).fillColor("#647084")
				.text("Totals include the acquirer settlements above, using their selected conversion rates.", left, y + 4, { width });
		}
		const range = doc.bufferedPageRange();
		for (let index = range.start; index < range.start + range.count; index++) {
			doc.switchToPage(index);
			doc.moveTo(left, doc.page.height - 72).lineTo(left + width, doc.page.height - 72).strokeColor("#D7DDE7").stroke();
			doc.font(fonts.regular).fontSize(7).fillColor("#647084")
				.text("Acquirer settlement | Payout summary", left, doc.page.height - 60, { width: width - 70, lineBreak: false });
		}
		doc.end();
	} catch (error) { doc.destroy(); reject(error); }
});

export const buildCombinedAcquirerPdfBuffer = async (report, parts, conversions, renderPdf, { registerFonts } = {}) => {
	if (!parts.length || parts.length !== conversions.length) settlementDownloadError("Incomplete acquirer settlement documents.");
	// Exclude zero payments only after the full source report has reconciled.
	const included = parts.map((part, index) => ({ part, conversion: conversions[index] }))
		.filter(({ conversion }) => cents(conversion.finalPayable) !== 0);
	const document = await PDFDocument.create();
	document.setTitle(`Acquirer Settlement - ${report.merchantName} - MID ${report.memberId}`);
	document.setAuthor("Settlement Team");
	document.setSubject(getSettlementPayoutTotals(included.map(({ conversion }) => conversion)).map((row) => `${row.currency} ${row.amount.toFixed(2)}`).join("; "));
	for (const { part, conversion } of included) {
		const source = await PDFDocument.load(await renderPdf(part, conversion, {
			audience: "internal", omitPageNumbers: true,
		}));
		const pages = await document.copyPages(source, source.getPageIndices());
		for (const page of pages) document.addPage(page);
	}
	const summary = await PDFDocument.load(await buildPayoutSummary(report, included, registerFonts));
	for (const page of await document.copyPages(summary, summary.getPageIndices())) document.addPage(page);
	const font = await document.embedFont(StandardFonts.Helvetica);
	const pages = document.getPages();
	for (let index = 0; index < pages.length; index++) {
		const page = pages[index];
		const label = `${index + 1} / ${pages.length}`;
		page.drawText(label, { x: page.getWidth() - 43 - font.widthOfTextAtSize(label, 7), y: 54,
			size: 7, font, color: rgb(100 / 255, 112 / 255, 132 / 255) });
	}
	return Buffer.from(await document.save());
};
