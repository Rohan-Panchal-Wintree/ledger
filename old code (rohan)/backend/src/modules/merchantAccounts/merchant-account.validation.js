import { z } from "zod";

export const merchantAccountSchema = z.object({
  merchantId: z.string(),
  mid: z.string().min(1),
  acquirerId: z.string(),
  processingCurrency: z.string().min(3).max(3),
  settlementCurrency: z.enum(["USD", "EUR"]),
  status: z.enum(["active", "inactive"]).optional()
});
