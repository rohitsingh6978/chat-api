import type { User as PrismaUser } from "@prisma/client";

export type AuthUser = Pick<PrismaUser, "id">;

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
