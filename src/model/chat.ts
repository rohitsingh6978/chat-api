import { ChatType, MemberRole, Prisma } from "@prisma/client";
import { prisma } from "../config/db";

export function findMember(chatId: number, userId: number) {
  return prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } });
}

export function findDirectChat(userIds: number[]) {
  return prisma.chat.findFirst({
    where: {
      type: ChatType.DIRECT,
      AND: userIds.map((userId) => ({ members: { some: { userId } } }))
    },
    select: { id: true }
  });
}

export function createDirectChat(userA: number, userB: number) {
  const data: Prisma.ChatCreateInput = {
    type: ChatType.DIRECT,
    createdBy: userA,
    members: { create: [{ user: { connect: { id: userA } } }, { user: { connect: { id: userB } } }] }
  };
  return prisma.chat.create({ data, select: { id: true } });
}

export function createGroup(name: string, creatorId: number, memberIds: number[]) {
  const data: Prisma.ChatCreateInput = {
    type: ChatType.GROUP,
    name,
    createdBy: creatorId,
    members: {
      create: memberIds.map((userId) => ({
        user: { connect: { id: userId } },
        role: userId === creatorId ? MemberRole.ADMIN : MemberRole.MEMBER
      }))
    }
  };
  return prisma.chat.create({
    data,
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } }
  });
}

export function getUserChats(userId: number) {
  return prisma.chat.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { select: { userId: true, role: true, user: { select: { id: true, name: true, email: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export function getChat(chatId: number) {
  return prisma.chat.findUnique({
    where: { id: chatId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } }
  });
}

export function getMembers(chatId: number) {
  return prisma.chatMember.findMany({
    where: { chatId },
    orderBy: { joinedAt: "asc" },
    select: { userId: true, role: true, user: { select: { id: true, name: true, email: true } } }
  });
}

export function addMembers(chatId: number, userIds: number[]) {
  return prisma.$transaction(async (tx) => {
    await tx.chatMember.createMany({
      data: userIds.map((userId) => ({ chatId, userId })),
      skipDuplicates: true
    });
    return tx.chatMember.findMany({
      where: { chatId },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, role: true, user: { select: { id: true, name: true, email: true } } }
    });
  });
}

export function removeMember(chatId: number, userId: number) {
  return prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId } } });
}

export function leaveGroup(chatId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const departing = await tx.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } });
    if (!departing) return { missing: true };

    await tx.chatMember.delete({ where: { chatId_userId: { chatId, userId } } });
    const remaining = await tx.chatMember.findMany({ where: { chatId }, orderBy: { joinedAt: "asc" } });
    if (remaining.length === 0) {
      await tx.chat.delete({ where: { id: chatId } });
    } else if (departing.role === MemberRole.ADMIN && !remaining.some((member) => member.role === MemberRole.ADMIN)) {
      await tx.chatMember.update({ where: { id: remaining[0].id }, data: { role: MemberRole.ADMIN } });
    }
    return { missing: false };
  });
}

export function renameGroup(chatId: number, name: string) {
  return prisma.chat.update({ where: { id: chatId }, data: { name }, select: { id: true, name: true } });
}
