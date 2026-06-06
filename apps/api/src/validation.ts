import { z } from "zod";

export const shopRegistrationSchema = z.object({
  name: z.string().min(1),
  shopName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  shopCategory: z.string().min(1),
});

export const activationSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const itemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  currentStock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
});

export const itemUpdateSchema = itemSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one item field is required.",
);

export const purchaseSchema = z.object({
  paymentMethod: z.enum(["CASH", "UPI"]),
  discount: z.coerce.number().nonnegative().default(0),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
});

export const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1),
});

export const staffInviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  roleId: z.string().min(1),
});

export const staffRoleUpdateSchema = z.object({
  roleId: z.string().min(1),
});

export const reportQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
