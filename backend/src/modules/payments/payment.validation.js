import { z } from "zod";

export const uploadPaymentSchema = z.object({
  batchId: z.string().optional(),
  paymentDate: z.string().optional()
});
