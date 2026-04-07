import { z } from "zod";

export const uploadWiresheetSchema = z.object({
  acquirerId: z.string().optional()
});
