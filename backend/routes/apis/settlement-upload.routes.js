import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler } from "../../utils/ManagedVariables.js";

import settlementUpload from "../../middlewares/settlementUpload.middleware.js";

import {
	uploadSettlementFiles,
	listSettlementUploads,
	generateSettlementDownloadLink,
	deleteSettlementUpload,
} from "../../controller/settlement-upload.controller.js";

import { authenticatedWriteLimiter } from "../../utils/rateLimiters.js";

const router = Router();

router.use(middlewares.authMiddleware);
router.use(
	middlewares.roleMiddleware(["admin", "finance", "settlement", "viewer"]),
);

const setUploadType = (type) => (req, _res, next) => {
	req.uploadType = type;
	next();
};

router.post(
	"/wiresheets",
	authenticatedWriteLimiter,
	middlewares.roleMiddleware(["admin", "finance"]),
	setUploadType("wiresheet"),
	settlementUpload.array("files", 10),
	asyncHandler(uploadSettlementFiles),
);

router.post(
	"/payment-sheets",
	authenticatedWriteLimiter,
	middlewares.roleMiddleware(["admin", "finance"]),
	setUploadType("payment_sheet"),
	settlementUpload.array("files", 10),
	asyncHandler(uploadSettlementFiles),
);

router.get(
	"/wiresheets",
	setUploadType("wiresheet"),
	asyncHandler(listSettlementUploads),
);

router.get(
	"/payment-sheets",
	setUploadType("payment_sheet"),
	asyncHandler(listSettlementUploads),
);

router.post(
	"/:id/download",
	authenticatedWriteLimiter,
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(generateSettlementDownloadLink),
);

router.delete(
	"/:id",
	authenticatedWriteLimiter,
	middlewares.roleMiddleware(["admin", "finance"]),
	asyncHandler(deleteSettlementUpload),
);

export default router;
