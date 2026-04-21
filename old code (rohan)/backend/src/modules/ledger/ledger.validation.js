import { z } from "zod";

export const ledgerQuerySchema = z.object({
  merchantName: z.string().optional(),
  mid: z.string().optional(),
  acquirer: z.string().optional(),
  settlementCurrency: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});
