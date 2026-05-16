import type { Permission } from "@billtrack/shared";

export type SessionUser = {
  id: string;
  shopId: string | null;
  isSuperadmin: boolean;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  permissions: Permission[];
};

export function hasPermission(
  user: SessionUser,
  permission: Permission,
): boolean {
  return user.isSuperadmin || user.permissions.includes(permission);
}

export function assertPermission(
  user: SessionUser,
  permission: Permission,
): void {
  if (!hasPermission(user, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}
