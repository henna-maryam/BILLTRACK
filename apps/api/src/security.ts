import type { Permission } from "@billtrack/shared";
import { assertPermission, type SessionUser } from "@billtrack/auth";

export function assertActiveTenantUser(
  user: SessionUser,
  shopId: string,
  permission: Permission,
): void {
  if (user.status !== "ACTIVE") {
    throw new Error("Inactive account");
  }

  if (!user.isSuperadmin && user.shopId !== shopId) {
    throw new Error("Cross-tenant access denied");
  }

  assertPermission(user, permission);
}
