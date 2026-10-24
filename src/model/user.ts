import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true
} satisfies Prisma.UserSelect;

export function createUser(data: Prisma.UserCreateInput) {
  return prisma.user.create({ data, select: publicUserSelect });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findUsersByEmails(emails: string[]) {
  return prisma.user.findMany({
    where: { email: { in: emails } },
    select: publicUserSelect
  });
}

export function findUsersByIds(ids: number[]) {
  return prisma.user.findMany({ where: { id: { in: ids } }, select: publicUserSelect });
}

export function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
}
