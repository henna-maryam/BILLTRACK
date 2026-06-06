import { db } from "@billtrack/db";
import { ownerPermissions, type Permission } from "@billtrack/shared";
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { FastifyRequest } from "fastify";

const tokenTtlSeconds = 60 * 60 * 24 * 7;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(normalized, "base64");
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? "local-development-secret-change-me";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

type TokenPayload = {
  sub: string;
  exp: number;
};

export function signSessionToken(userId: string): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
    } satisfies TokenPayload),
  );
  const unsignedToken = `${header}.${payload}`;
  const signature = base64Url(
    createHmac("sha256", getJwtSecret()).update(unsignedToken).digest(),
  );

  return `${unsignedToken}.${signature}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const unsignedToken = `${header}.${payload}`;
  const expectedSignature = base64Url(
    createHmac("sha256", getJwtSecret()).update(unsignedToken).digest(),
  );
  const received = decodeBase64Url(signature);
  const expected = decodeBase64Url(expectedSignature);

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  const parsed = JSON.parse(decodeBase64Url(payload).toString("utf8")) as TokenPayload;

  if (!parsed.sub || parsed.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return parsed;
}

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  shopId: string;
  shopName: string;
  isSuperadmin: boolean;
  permissions: Permission[];
};

export async function authenticateRequest(
  request: FastifyRequest,
): Promise<AuthenticatedUser | null> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const user = await db.user.findUnique({
    where: {
      id: payload.sub,
    },
    include: {
      shop: true,
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.shop ||
    user.shop.status !== "ACTIVE"
  ) {
    return null;
  }

  const isOwner = user.email === user.shop.ownerEmail;
  const rolePermissions =
    user.role?.permissions.map((entry) => entry.permission.key as Permission) ?? [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    shopId: user.shop.id,
    shopName: user.shop.name,
    isSuperadmin: user.isSuperadmin,
    permissions:
      user.isSuperadmin || isOwner ? ownerPermissions.slice() : rolePermissions,
  };
}

export function requirePermission(
  user: AuthenticatedUser,
  permission: Permission,
): void {
  if (!user.isSuperadmin && !user.permissions.includes(permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}
