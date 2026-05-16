import { z } from "zod";

export const shopRegistrationSchema = z.object({
  name: z.string().min(1),
  shopName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  shopCategory: z.string().min(1),
});
