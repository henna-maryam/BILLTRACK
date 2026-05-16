export const permissions = [
  "CREATE_PURCHASE",
  "VIEW_PURCHASES",
  "ADD_ITEM",
  "EDIT_ITEM",
  "DELETE_ITEM",
  "MANAGE_STAFF",
  "VIEW_REPORTS",
  "DOWNLOAD_REPORTS",
] as const;

export type Permission = (typeof permissions)[number];

export const ownerPermissions = permissions;
