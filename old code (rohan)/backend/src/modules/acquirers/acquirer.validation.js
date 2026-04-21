import { z } from "zod";

export const acquirerSchema = z.object({
  name: z.string().min(2)
});
