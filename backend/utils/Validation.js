import { z } from "zod";

const userRoleSchema = z.enum(["admin", "merchant", "finance", "settlement"]);

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2),
    email: z.email(),
    role: userRoleSchema,
    merchantMid: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "merchant" && !data.merchantMid) {
      ctx.addIssue({
        code: "custom",
        path: ["merchantMid"],
        message: "MID is required for merchant users",
      });
    }
  });

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    email: z.email().optional(),
    role: userRoleSchema.optional(),
    merchantMid: z.string().trim().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "merchant" && !data.merchantMid) {
      ctx.addIssue({
        code: "custom",
        path: ["merchantMid"],
        message: "MID is required for merchant users",
      });
    }
  });

export const uploadWiresheetSchema = z.object({
  acquirerId: z.string().optional(),
});

// MERCHANT

export const createMerchantSchema = z.object({
  merchantName: z.string().min(2),
  merchantTag: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateMerchantSchema = createMerchantSchema.partial();

// ACQUIRER

export const createAcquirerSchema = z.object({
  name: z.string().min(2),
});

export const updateAcquirerSchema = createAcquirerSchema.partial();

/**
 * 📤 Upload Payment Validation
 * Only validates body (file handled by multer)
 */
export const uploadPaymentSchema = z.object({
  paymentDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || !Number.isNaN(new Date(val).getTime()),
      "Invalid payment date",
    ),
});

/**
 * 🔄 Reconcile Validation
 * (you can extend later if needed)
 */
export const reconcileUnmatchedPaymentsSchema = z.object({});

// AUTH
export const requestOtpSchema = z.object({
  email: z.email(),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  role: z.enum(["admin", "merchant", "finance", "settlement"]),
  isActive: z.boolean().optional(),
});

export const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

// MISSILIONOUS

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((val) => (val === "" ? undefined : val))
  .optional();

const objectIdString = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid identifier");

const optionalObjectIdString = z
  .string()
  .trim()
  .transform((val) => (val === "" ? undefined : val))
  .optional()
  .refine(
    (val) => val === undefined || /^[a-f\d]{24}$/i.test(val),
    "Invalid identifier",
  );

const optionalDateString = z
  .string()
  .trim()
  .transform((val) => (val === "" ? undefined : val))
  .optional();

const optionalNumber = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  return val;
}, z.coerce.number().finite().optional());

const miscellaneousBaseSchema = z.object({
  entryType: z.enum([
    "repayment",
    "bank_rr",
    "rr",
    "agent",
    "overcapped_rr_refund",
    "chb_refund",
    "adjustment",
    "other",
  ]),

  paymentSheetDate: z.string().trim().min(1, "Payment sheet date is required"),

  bankLabel: z.string().trim().min(1, "Bank label is required"),

  merchantId: optionalObjectIdString,
  merchantName: z.string().trim().min(1, "Merchant name is required"),

  merchantMappingId: optionalObjectIdString,

  mid: optionalTrimmedString,

  startDate: optionalDateString,
  endDate: optionalDateString,

  processingCurrency: optionalTrimmedString,

  amountPaid: z.coerce.number().finite(),

  rate: optionalNumber,

  settlementCurrency: z
    .string()
    .trim()
    .min(1, "Settlement currency is required"),

  settlementAmount: z.coerce.number().finite(),

  notes: optionalTrimmedString,
});

export const createMiscellaneousPaymentSchema = miscellaneousBaseSchema;
export const updateMiscellaneousPaymentSchema = miscellaneousBaseSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

export const dashboardPeriodSchema = z
  .object({
    paymentDate: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    acquirer: z.string().optional(),
    merchantName: z.string().optional(),
    mid: z.string().optional(),
    status: z.enum(["pending", "partially_paid", "settled"]).optional(),
    paymentMethod: z.enum(["CRYPTO", "WIRE", "UNKNOWN"]).optional(),
    settlementCurrency: z.string().optional(),
  })
  .refine(
    (payload) => {
      if (!payload.fromDate && !payload.toDate) return true;
      return Boolean(payload.fromDate && payload.toDate);
    },
    {
      message: "Both fromDate and toDate are required for date range.",
      path: ["toDate"],
    },
  )
  .refine(
    (payload) => {
      if (!payload.fromDate || !payload.toDate) return true;

      const fromDate = new Date(payload.fromDate);
      const toDate = new Date(payload.toDate);

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return false;
      }

      return fromDate <= toDate;
    },
    {
      message: "fromDate cannot be after toDate.",
      path: ["fromDate"],
    },
  );

export const reportBankSchema = z.object({
  paymentDate: z.string().optional(),
  acquirer: z.string().optional(),
});
