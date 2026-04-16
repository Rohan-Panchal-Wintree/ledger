import { z } from "zod";

export const merchantSchema = z.object({
  merchantName: z.string().min(2),
  merchantTag: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

