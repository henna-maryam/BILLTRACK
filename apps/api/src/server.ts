import cors from "@fastify/cors";
import { db } from "@billtrack/db";
import { permissions, type Permission } from "@billtrack/shared";
import Fastify from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  activationSchema,
  itemSchema,
  itemUpdateSchema,
  loginSchema,
  purchaseSchema,
  reportQuerySchema,
  roleSchema,
  staffInviteSchema,
  staffRoleUpdateSchema,
  shopRegistrationSchema,
} from "./validation";
import {
  authenticateRequest,
  hashPassword,
  hashToken,
  requirePermission,
  signSessionToken,
  verifyPassword,
} from "./auth";

const server = Fastify({
  logger: true,
});

server.setErrorHandler((error, _request, reply) => {
  const safeError =
    error instanceof Error ? error : new Error("Unknown server error");

  if (safeError.message.startsWith("INSUFFICIENT_STOCK:")) {
    return reply.status(400).send({
      error: "INSUFFICIENT_STOCK",
      message: `Insufficient stock for ${safeError.message.split(":")[1]}.`,
    });
  }

  if (safeError.message === "ITEM_NOT_FOUND") {
    return reply.status(404).send({
      error: "ITEM_NOT_FOUND",
      message: "One or more items were not found.",
    });
  }

  requestLogSafeError(safeError);

  return reply.status(500).send({
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong.",
  });
});

function requestLogSafeError(error: Error): void {
  server.log.error({
    message: error.message,
    stack: error.stack,
  });
}

await server.register(cors, {
  origin: true,
  credentials: true,
});

server.get("/health", async () => ({
  ok: true,
  service: "billtrack-api",
}));

server.get("/admin/shops/summary", async () => {
  const [pendingRequests, activeShops, suspendedShops] = await Promise.all([
    db.shop.count({
      where: {
        status: "PENDING_APPROVAL",
      },
    }),
    db.shop.count({
      where: {
        status: "ACTIVE",
      },
    }),
    db.shop.count({
      where: {
        status: "SUSPENDED",
      },
    }),
  ]);

  return {
    pendingRequests,
    activeShops,
    suspendedShops,
  };
});

server.get("/admin/registration-requests", async () => {
  const requests = await db.shop.findMany({
    where: {
      status: "PENDING_APPROVAL",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      category: true,
      ownerName: true,
      ownerEmail: true,
      ownerPhone: true,
      status: true,
      createdAt: true,
    },
  });

  return {
    requests,
  };
});

server.get("/admin/roles", async () => {
  const roles = await db.staffRole.findMany({
    where: {
      shopId: null,
    },
    orderBy: {
      name: "asc",
    },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  return {
    permissions,
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((entry) => entry.permission.key),
    })),
  };
});

server.post("/admin/roles", async (request, reply) => {
  const result = roleSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  const invalidPermissions = result.data.permissions.filter(
    (permission) => !permissions.includes(permission as Permission),
  );

  if (invalidPermissions.length > 0) {
    return reply.status(400).send({
      error: "INVALID_PERMISSIONS",
      permissions: invalidPermissions,
    });
  }

  const permissionRows = await db.permission.findMany({
    where: {
      key: {
        in: result.data.permissions,
      },
    },
  });

  const role = await db.staffRole.create({
    data: {
      shopId: null,
      name: result.data.name,
      description: result.data.description,
      permissions: {
        create: permissionRows.map((permission) => ({
          permissionId: permission.id,
        })),
      },
    },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  return reply.status(201).send({
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((entry) => entry.permission.key),
    },
  });
});

server.put("/admin/roles/:roleId", async (request, reply) => {
  const params = z.object({ roleId: z.string().min(1) }).safeParse(request.params);
  const result = roleSchema.safeParse(request.body);

  if (!params.success || !result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
    });
  }

  const permissionRows = await db.permission.findMany({
    where: {
      key: {
        in: result.data.permissions,
      },
    },
  });

  const role = await db.$transaction(async (tx) => {
    await tx.staffRolePermission.deleteMany({
      where: {
        roleId: params.data.roleId,
      },
    });

    return tx.staffRole.update({
      where: {
        id: params.data.roleId,
      },
      data: {
        name: result.data.name,
        description: result.data.description,
        permissions: {
          create: permissionRows.map((permission) => ({
            permissionId: permission.id,
          })),
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  });

  return {
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((entry) => entry.permission.key),
    },
  };
});

server.delete("/admin/roles/:roleId", async (request, reply) => {
  const params = z.object({ roleId: z.string().min(1) }).safeParse(request.params);

  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR" });
  }

  await db.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: {
        roleId: params.data.roleId,
      },
      data: {
        roleId: null,
      },
    });

    await tx.staffRole.delete({
      where: {
        id: params.data.roleId,
      },
    });
  });

  return reply.status(204).send();
});

const shopActionParamsSchema = z.object({
  shopId: z.string().min(1),
});

server.post(
  "/admin/registration-requests/:shopId/approve",
  async (request, reply) => {
    const params = shopActionParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        issues: params.error.flatten(),
      });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const result = await db.$transaction(async (tx) => {
      const shop = await tx.shop.findUnique({
        where: {
          id: params.data.shopId,
        },
        select: {
          id: true,
          name: true,
          ownerName: true,
          ownerEmail: true,
          status: true,
        },
      });

      if (!shop) {
        return {
          error: "SHOP_NOT_FOUND" as const,
        };
      }

      if (shop.status !== "PENDING_APPROVAL") {
        return {
          error: "SHOP_NOT_PENDING" as const,
          status: shop.status,
        };
      }

      const owner = await tx.user.upsert({
        where: {
          email: shop.ownerEmail,
        },
        update: {
          name: shop.ownerName,
          shopId: shop.id,
          status: "INVITED",
          isSuperadmin: false,
        },
        create: {
          name: shop.ownerName,
          email: shop.ownerEmail,
          shopId: shop.id,
          status: "INVITED",
          isSuperadmin: false,
        },
        select: {
          id: true,
          email: true,
        },
      });

      await tx.activationToken.create({
        data: {
          shopId: shop.id,
          email: shop.ownerEmail,
          tokenHash,
          purpose: "OWNER_ACTIVATION",
          expiresAt,
        },
      });

      const updatedShop = await tx.shop.update({
        where: {
          id: shop.id,
        },
        data: {
          status: "APPROVED_PENDING_ACTIVATION",
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
      });

      return {
        owner,
        shop: updatedShop,
      };
    });

    if ("error" in result) {
      if (result.error === "SHOP_NOT_FOUND") {
        return reply.status(404).send({
          error: result.error,
          message: "Shop request was not found.",
        });
      }

      return reply.status(409).send({
        error: result.error,
        message: "Only pending shop requests can be approved.",
        status: result.status,
      });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    return reply.send({
      ...result,
      activation: {
        expiresAt,
        url: `${appUrl}/activate?token=${token}`,
      },
    });
  },
);

server.post(
  "/admin/registration-requests/:shopId/reject",
  async (request, reply) => {
    const params = shopActionParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        issues: params.error.flatten(),
      });
    }

    const shop = await db.shop.findUnique({
      where: {
        id: params.data.shopId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!shop) {
      return reply.status(404).send({
        error: "SHOP_NOT_FOUND",
        message: "Shop request was not found.",
      });
    }

    if (shop.status !== "PENDING_APPROVAL") {
      return reply.status(409).send({
        error: "SHOP_NOT_PENDING",
        message: "Only pending shop requests can be rejected.",
        status: shop.status,
      });
    }

    const rejectedShop = await db.shop.update({
      where: {
        id: shop.id,
      },
      data: {
        status: "REJECTED",
      },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      shop: rejectedShop,
    };
  },
);

server.post("/activation/complete", async (request, reply) => {
  const result = activationSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  const tokenHash = hashToken(result.data.token);

  const activation = await db.activationToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      shop: true,
    },
  });

  if (
    !activation ||
    activation.usedAt ||
    activation.expiresAt < new Date() ||
    !activation.shop ||
    !["OWNER_ACTIVATION", "STAFF_INVITE"].includes(activation.purpose)
  ) {
    return reply.status(400).send({
      error: "INVALID_ACTIVATION_TOKEN",
      message: "Activation link is invalid or expired.",
    });
  }

  if (
    activation.purpose === "OWNER_ACTIVATION" &&
    activation.shop.status !== "APPROVED_PENDING_ACTIVATION"
  ) {
    return reply.status(400).send({
      error: "INVALID_ACTIVATION_TOKEN",
      message: "Activation link is invalid or expired.",
    });
  }

  if (activation.purpose === "STAFF_INVITE" && activation.shop.status !== "ACTIVE") {
    return reply.status(400).send({
      error: "SHOP_INACTIVE",
      message: "This shop is not active.",
    });
  }

  const passwordHash = hashPassword(result.data.password);
  const activationShop = activation.shop;

  const user = await db.$transaction(async (tx) => {
    const owner = await tx.user.update({
      where: {
        email: activation.email,
      },
      data: {
        passwordHash,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (activation.purpose === "OWNER_ACTIVATION") {
      await tx.shop.update({
        where: {
          id: activation.shopId ?? activationShop.id,
        },
        data: {
          status: "ACTIVE",
        },
      });
    }

    await tx.activationToken.update({
      where: {
        id: activation.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

    return owner;
  });

  return {
    user,
    token: signSessionToken(user.id),
  };
});

server.post("/auth/login", async (request, reply) => {
  const result = loginSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  const user = await db.user.findUnique({
    where: {
      email: result.data.email,
    },
    include: {
      shop: true,
    },
  });

  if (
    !user ||
    !user.passwordHash ||
    user.status !== "ACTIVE" ||
    !user.shop ||
    user.shop.status !== "ACTIVE" ||
    !verifyPassword(result.data.password, user.passwordHash)
  ) {
    return reply.status(401).send({
      error: "INVALID_LOGIN",
      message: "Invalid email or password.",
    });
  }

  return {
    token: signSessionToken(user.id),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      shopId: user.shop.id,
      shopName: user.shop.name,
    },
  };
});

server.get("/me", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({
      error: "UNAUTHENTICATED",
    });
  }

  return {
    user,
  };
});

server.get("/roles", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  const roles = await db.staffRole.findMany({
    where: {
      shopId: null,
    },
    orderBy: {
      name: "asc",
    },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  return {
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((entry) => entry.permission.key),
    })),
  };
});

server.get("/staff", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  try {
    requirePermission(user, "MANAGE_STAFF");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const staff = await db.user.findMany({
    where: {
      shopId: user.shopId,
      email: {
        not: user.email,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      role: true,
    },
  });

  return {
    staff: staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      status: member.status,
      role: member.role
        ? {
            id: member.role.id,
            name: member.role.name,
          }
        : null,
    })),
  };
});

server.post("/staff/invite", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  try {
    requirePermission(user, "MANAGE_STAFF");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const result = staffInviteSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  const role = await db.staffRole.findFirst({
    where: {
      id: result.data.roleId,
      shopId: null,
    },
  });

  if (!role) {
    return reply.status(404).send({
      error: "ROLE_NOT_FOUND",
      message: "Role was not found.",
    });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  const staff = await db.$transaction(async (tx) => {
    const member = await tx.user.upsert({
      where: {
        email: result.data.email,
      },
      update: {
        name: result.data.name,
        shopId: user.shopId,
        roleId: role.id,
        status: "INVITED",
        isSuperadmin: false,
      },
      create: {
        name: result.data.name,
        email: result.data.email,
        shopId: user.shopId,
        roleId: role.id,
        status: "INVITED",
        isSuperadmin: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    });

    await tx.activationToken.create({
      data: {
        shopId: user.shopId,
        email: result.data.email,
        tokenHash,
        purpose: "STAFF_INVITE",
        expiresAt,
      },
    });

    return member;
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return reply.status(201).send({
    staff,
    activation: {
      expiresAt,
      url: `${appUrl}/activate?token=${token}`,
    },
  });
});

server.put("/staff/:staffId/role", async (request, reply) => {
  const user = await authenticateRequest(request);
  const params = z.object({ staffId: z.string().min(1) }).safeParse(request.params);
  const result = staffRoleUpdateSchema.safeParse(request.body);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  if (!params.success || !result.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR" });
  }

  try {
    requirePermission(user, "MANAGE_STAFF");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const staff = await db.user.updateMany({
    where: {
      id: params.data.staffId,
      shopId: user.shopId,
    },
    data: {
      roleId: result.data.roleId,
    },
  });

  return {
    updated: staff.count,
  };
});

server.post("/staff/:staffId/suspend", async (request, reply) => {
  const user = await authenticateRequest(request);
  const params = z.object({ staffId: z.string().min(1) }).safeParse(request.params);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR" });
  }

  try {
    requirePermission(user, "MANAGE_STAFF");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const staff = await db.user.updateMany({
    where: {
      id: params.data.staffId,
      shopId: user.shopId,
    },
    data: {
      status: "SUSPENDED",
    },
  });

  return {
    updated: staff.count,
  };
});

server.get("/owner/dashboard", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayPurchases, lowStockItems, recentPurchases] = await Promise.all([
    db.purchase.findMany({
      where: {
        shopId: user.shopId,
        createdAt: {
          gte: startOfToday,
        },
      },
      select: {
        total: true,
        paymentMethod: true,
      },
    }),
    db.item.findMany({
      where: {
        shopId: user.shopId,
      },
      orderBy: {
        currentStock: "asc",
      },
      take: 20,
    }),
    db.purchase.findMany({
      where: {
        shopId: user.shopId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    }),
  ]);

  const lowStock = lowStockItems.filter(
    (item) => item.currentStock <= item.lowStockThreshold,
  );
  const grossSales = todayPurchases.reduce(
    (sum, purchase) => sum + Number(purchase.total),
    0,
  );
  const cashSales = todayPurchases
    .filter((purchase) => purchase.paymentMethod === "CASH")
    .reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const upiSales = todayPurchases
    .filter((purchase) => purchase.paymentMethod === "UPI")
    .reduce((sum, purchase) => sum + Number(purchase.total), 0);

  return {
    shop: {
      id: user.shopId,
      name: user.shopName,
    },
    today: {
      grossSales,
      cashSales,
      upiSales,
      transactionCount: todayPurchases.length,
    },
    lowStock,
    recentPurchases,
  };
});

server.get("/items", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  const items = await db.item.findMany({
    where: {
      shopId: user.shopId,
    },
    orderBy: {
      name: "asc",
    },
  });

  return { items };
});

server.post("/items", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  try {
    requirePermission(user, "ADD_ITEM");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const result = itemSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  const item = await db.item.create({
    data: {
      ...result.data,
      shopId: user.shopId,
      price: result.data.price,
    },
  });

  return reply.status(201).send({ item });
});

server.put("/items/:itemId", async (request, reply) => {
  const user = await authenticateRequest(request);
  const params = z.object({ itemId: z.string().min(1) }).safeParse(request.params);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR" });
  }

  try {
    requirePermission(user, "EDIT_ITEM");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const result = itemUpdateSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  const updateResult = await db.item.updateMany({
    where: {
      id: params.data.itemId,
      shopId: user.shopId,
    },
    data: result.data,
  });

  if (updateResult.count === 0) {
    return reply.status(404).send({ error: "ITEM_NOT_FOUND" });
  }

  return {
    updated: updateResult.count,
  };
});

server.delete("/items/:itemId", async (request, reply) => {
  const user = await authenticateRequest(request);
  const params = z.object({ itemId: z.string().min(1) }).safeParse(request.params);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  if (!params.success) {
    return reply.status(400).send({ error: "VALIDATION_ERROR" });
  }

  try {
    requirePermission(user, "DELETE_ITEM");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const deleteResult = await db.item.deleteMany({
    where: {
      id: params.data.itemId,
      shopId: user.shopId,
    },
  });

  if (deleteResult.count === 0) {
    return reply.status(404).send({ error: "ITEM_NOT_FOUND" });
  }

  return reply.status(204).send();
});

server.post("/purchases", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  try {
    requirePermission(user, "CREATE_PURCHASE");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const result = purchaseSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  const purchase = await db.$transaction(async (tx) => {
    const itemIds = result.data.items.map((item) => item.itemId);
    const items = await tx.item.findMany({
      where: {
        id: {
          in: itemIds,
        },
        shopId: user.shopId,
      },
    });

    if (items.length !== itemIds.length) {
      throw new Error("ITEM_NOT_FOUND");
    }

    const purchaseItems = result.data.items.map((purchaseItem) => {
      const item = items.find((entry) => entry.id === purchaseItem.itemId);

      if (!item) {
        throw new Error("ITEM_NOT_FOUND");
      }

      if (item.currentStock < purchaseItem.quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${item.name}`);
      }

      const unitPrice = Number(item.price);
      const lineTotal = unitPrice * purchaseItem.quantity;

      return {
        item,
        quantity: purchaseItem.quantity,
        unitPrice,
        lineTotal,
      };
    });

    const subtotal = purchaseItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const total = Math.max(0, subtotal - result.data.discount);

    const createdPurchase = await tx.purchase.create({
      data: {
        shopId: user.shopId,
        createdById: user.id,
        paymentMethod: result.data.paymentMethod,
        subtotal,
        discount: result.data.discount,
        total,
        items: {
          create: purchaseItems.map((purchaseItem) => ({
            itemId: purchaseItem.item.id,
            quantity: purchaseItem.quantity,
            unitPrice: purchaseItem.unitPrice,
            lineTotal: purchaseItem.lineTotal,
          })),
        },
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    for (const purchaseItem of purchaseItems) {
      await tx.item.update({
        where: {
          id: purchaseItem.item.id,
        },
        data: {
          currentStock: {
            decrement: purchaseItem.quantity,
          },
        },
      });
    }

    return createdPurchase;
  });

  return reply.status(201).send({ purchase });
});

function getReportRange(query: unknown): { gte?: Date; lte?: Date } {
  const result = reportQuerySchema.safeParse(query);

  if (!result.success) {
    return {};
  }

  if (result.data.month) {
    const [yearText, monthText] = result.data.month.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return {
      gte: start,
      lte: end,
    };
  }

  return {
    gte: result.data.from ? new Date(`${result.data.from}T00:00:00`) : undefined,
    lte: result.data.to ? new Date(`${result.data.to}T23:59:59`) : undefined,
  };
}

async function buildSalesReport(shopId: string, query: unknown) {
  const range = getReportRange(query);
  const purchases = await db.purchase.findMany({
    where: {
      shopId,
      createdAt:
        range.gte || range.lte
          ? {
              gte: range.gte,
              lte: range.lte,
            }
          : undefined,
    },
    include: {
      items: {
        include: {
          item: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const grossSales = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.subtotal),
    0,
  );
  const discounts = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.discount),
    0,
  );
  const netRevenue = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.total),
    0,
  );
  const cashSales = purchases
    .filter((purchase) => purchase.paymentMethod === "CASH")
    .reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const upiSales = purchases
    .filter((purchase) => purchase.paymentMethod === "UPI")
    .reduce((sum, purchase) => sum + Number(purchase.total), 0);

  const topSellingItems = new Map<string, { name: string; quantity: number }>();

  for (const purchase of purchases) {
    for (const purchaseItem of purchase.items) {
      const existing = topSellingItems.get(purchaseItem.itemId) ?? {
        name: purchaseItem.item.name,
        quantity: 0,
      };
      existing.quantity += purchaseItem.quantity;
      topSellingItems.set(purchaseItem.itemId, existing);
    }
  }

  return {
    grossSales,
    discounts,
    netRevenue,
    cashSales,
    upiSales,
    transactionCount: purchases.length,
    topSellingItems: [...topSellingItems.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10),
  };
}

function buildSimplePdf(lines: string[]): Buffer {
  const content = lines
    .map((line, index) => `BT /F1 12 Tf 50 ${760 - index * 22} Td (${line.replace(/[()]/g, "")}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf);
}

server.get("/reports/sales", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  try {
    requirePermission(user, "VIEW_REPORTS");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  return buildSalesReport(user.shopId, request.query);
});

server.get("/reports/sales.pdf", async (request, reply) => {
  const user = await authenticateRequest(request);

  if (!user) {
    return reply.status(401).send({ error: "UNAUTHENTICATED" });
  }

  try {
    requirePermission(user, "DOWNLOAD_REPORTS");
  } catch {
    return reply.status(403).send({ error: "FORBIDDEN" });
  }

  const report = await buildSalesReport(user.shopId, request.query);
  const pdf = buildSimplePdf([
    `${user.shopName} Sales Report`,
    `Gross sales: ${report.grossSales}`,
    `Discounts: ${report.discounts}`,
    `Net revenue: ${report.netRevenue}`,
    `Cash sales: ${report.cashSales}`,
    `UPI sales: ${report.upiSales}`,
    `Transaction count: ${report.transactionCount}`,
    "Top selling items:",
    ...report.topSellingItems.map((item) => `${item.name}: ${item.quantity}`),
  ]);

  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", 'attachment; filename="sales-report.pdf"')
    .send(pdf);
});

server.post("/registration-requests", async (request, reply) => {
  const result = shopRegistrationSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  const requestData = result.data;

  const existingShop = await db.shop.findUnique({
    where: {
      ownerEmail: requestData.email,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingShop) {
    return reply.status(409).send({
      error: "REGISTRATION_EXISTS",
      message: "A registration request already exists for this email.",
      shopId: existingShop.id,
      status: existingShop.status,
    });
  }

  const shop = await db.shop.create({
    data: {
      name: requestData.shopName,
      category: requestData.shopCategory,
      ownerName: requestData.name,
      ownerEmail: requestData.email,
      ownerPhone: requestData.phone,
      status: "PENDING_APPROVAL",
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  return reply.status(201).send({
    shop,
  });
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ port, host });
