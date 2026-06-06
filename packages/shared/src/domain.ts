export const tenantStatuses = [
  "PENDING_APPROVAL",
  "APPROVED_PENDING_ACTIVATION",
  "ACTIVE",
  "SUSPENDED",
  "REJECTED",
] as const;

export type TenantStatus = (typeof tenantStatuses)[number];

export const userStatuses = ["INVITED", "ACTIVE", "SUSPENDED"] as const;

export type UserStatus = (typeof userStatuses)[number];

export const paymentMethods = ["CASH", "UPI"] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

export type TenantScoped = {
  shopId: string;
};
