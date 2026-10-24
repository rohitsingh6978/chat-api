import type { Request, Response } from "express";
import { ChatType, MemberRole } from "@prisma/client";
import {
  addMembers, createDirectChat, createGroup, findDirectChat, findMember,
  getChat, getMembers, leaveGroup, removeMember, renameGroup
} from "../../model/chat";
import { findUsersByEmails, findUsersByIds } from "../../model/user";
import { findMessage, getMessages, markRead, saveMessage, setLastSeen } from "../../model/message";

function chatIdFrom(req: Request): number {
  return Number(req.params.chatId);
}

function messageIdFrom(req: Request): string {
  return typeof req.params.messageId === "string" ? req.params.messageId : "";
}

function validChatId(chatId: number): boolean {
  return Number.isInteger(chatId) && chatId > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function emailsFrom(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((email) => typeof email !== "string")) return null;
  return [...new Set(value.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export async function createDirect(req: Request, res: Response): Promise<void> {
  try {
    const requesterId = req.user!.id;
    const body = req.body as { userAId?: number; userBId?: number; email?: string };
    let userAId = body.userAId;
    let userBId = body.userBId;

    if (body.email) {
      const other = (await findUsersByEmails([body.email.trim().toLowerCase()]))[0];
      if (!other) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      userAId = requesterId;
      userBId = other.id;
    }
    if (!isInteger(userAId) || !isInteger(userBId)) {
      res.status(400).json({ message: "Provide both userAId and userBId, or an email" });
      return;
    }
    if (userAId !== requesterId && userBId !== requesterId) {
      res.status(403).json({ message: "You can only create a chat for yourself" });
      return;
    }
    if (userAId === userBId) {
      res.status(400).json({ message: "A direct chat needs two different users" });
      return;
    }
    const users = await findUsersByIds([userAId, userBId]);
    if (users.length !== 2) {
      res.status(404).json({ message: "One or both users were not found" });
      return;
    }
    const existing = await findDirectChat([userAId, userBId]);
    if (existing) {
      res.status(200).json({ message: "Direct chat already exists", chatId: existing.id });
      return;
    }
    const chat = await createDirectChat(userAId, userBId);
    res.status(201).json({ message: "Direct chat created successfully", chatId: chat.id });
  } catch (error) {
    console.error("Create chat failed", error);
    res.status(500).json({ message: "Could not create chat" });
  }
}

export async function createGroupChat(req: Request, res: Response): Promise<void> {
  try {
    const { name, emails: inputEmails } = req.body as { name?: string; emails?: unknown };
    if (!name?.trim()) {
      res.status(400).json({ message: "Group name is required" });
      return;
    }
    const emails = emailsFrom(inputEmails);
    if (!emails || emails.length === 0) {
      res.status(400).json({ message: "Provide at least two other user emails" });
      return;
    }
    const otherUsers = await findUsersByEmails(emails);
    const missing = emails.filter((email) => !otherUsers.some((user) => user.email === email));
    if (missing.length) {
      res.status(404).json({ message: `Users not found: ${missing.join(", ")}` });
      return;
    }
    const filtered = otherUsers.filter((user) => user.id !== req.user!.id);
    if (filtered.length < 2) {
      res.status(400).json({ message: "A group needs at least two other users" });
      return;
    }
    const chat = await createGroup(name.trim(), req.user!.id, [req.user!.id, ...filtered.map((user) => user.id)]);
    res.status(201).json({
      message: "Group created successfully",
      chatId: chat.id,
      name: chat.name,
      members: chat.members.map((member) => ({ id: member.user.id, name: member.user.name, email: member.user.email, role: member.role }))
    });
  } catch (error) {
    console.error("Create group failed", error);
    res.status(500).json({ message: "Could not create group" });
  }
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    const { text } = req.body as { text?: string };
    const senderId = req.user!.id;
    if (!validChatId(chatId) || !text?.trim()) {
      res.status(400).json({ message: "Chat id and message text are required" });
      return;
    }
    if (!(await findMember(chatId, senderId))) {
      res.status(403).json({ message: "You are not a member of this chat" });
      return;
    }
    const message = await saveMessage(chatId, senderId, text.trim());
    res.status(201).json({ message: "Message sent successfully", result: message });
  } catch (error) {
    console.error("Send message failed", error);
    res.status(500).json({ message: "Could not send message" });
  }
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    if (!validChatId(chatId)) {
      res.status(400).json({ message: "Invalid chat id" });
      return;
    }
    if (!(await findMember(chatId, req.user!.id))) {
      res.status(403).json({ message: "You are not a member of this chat" });
      return;
    }
    const requested = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!Number.isInteger(requested) || requested < 1) {
      res.status(400).json({ message: "Limit must be between 1 and 100" });
      return;
    }
    const messages = await getMessages(chatId, Math.min(requested, 100), typeof req.query.before === "string" ? req.query.before : undefined);
    res.status(200).json({ message: "Messages retrieved successfully", messages });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid before value") {
      res.status(400).json({ message: "Invalid before value" });
      return;
    }
    console.error("Get messages failed", error);
    res.status(500).json({ message: "Could not get messages" });
  }
}

export async function markMessageRead(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    const { userId } = req.body as { userId?: number };
    if (!validChatId(chatId) || !isInteger(userId)) {
      res.status(400).json({ message: "Valid chat and user ids are required" });
      return;
    }
    if (userId !== req.user!.id) {
      res.status(403).json({ message: "User does not match the logged-in user" });
      return;
    }
    if (!(await findMember(chatId, userId))) {
      res.status(403).json({ message: "You are not a member of this chat" });
      return;
    }
    const messageId = messageIdFrom(req);
    if (!messageId) {
      res.status(400).json({ message: "Invalid message id" });
      return;
    }
    const message = await findMessage(chatId, messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (message.senderId === userId) {
      res.status(400).json({ message: "You cannot mark your own message as read" });
      return;
    }
    res.status(200).json({ message: "Message marked as read", result: await markRead(chatId, messageId, userId) });
  } catch (error) {
    console.error("Mark read failed", error);
    res.status(500).json({ message: "Could not update read receipt" });
  }
}

export async function updateLastSeen(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    const { userId, messageId } = req.body as { userId?: number; messageId?: string };
    if (!validChatId(chatId) || !isInteger(userId) || typeof messageId !== "string" || !messageId) {
      res.status(400).json({ message: "Chat id, user id and message id are required" });
      return;
    }
    if (userId !== req.user!.id) {
      res.status(403).json({ message: "User does not match the logged-in user" });
      return;
    }
    if (!(await findMember(chatId, userId))) {
      res.status(403).json({ message: "You are not a member of this chat" });
      return;
    }
    if (!(await findMessage(chatId, messageId))) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    await setLastSeen(chatId, userId, messageId);
    res.status(200).json({ message: "Last seen updated" });
  } catch (error) {
    console.error("Last seen failed", error);
    res.status(500).json({ message: "Could not update last seen" });
  }
}

async function adminGroup(chatId: number, userId: number, res: Response) {
  const chat = await getChat(chatId);
  if (!chat) {
    res.status(404).json({ message: "Chat not found" });
    return null;
  }
  if (chat.type !== ChatType.GROUP) {
    res.status(400).json({ message: "This action only works for group chats" });
    return null;
  }
  const member = chat.members.find((item) => item.userId === userId);
  if (!member) {
    res.status(403).json({ message: "You are not a member of this chat" });
    return null;
  }
  if (member.role !== MemberRole.ADMIN) {
    res.status(403).json({ message: "Only group admins can do this" });
    return null;
  }
  return chat;
}

export async function addGroupMembers(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    if (!validChatId(chatId)) { res.status(400).json({ message: "Invalid chat id" }); return; }
    if (!(await adminGroup(chatId, req.user!.id, res))) return;
    const emails = emailsFrom((req.body as { emails?: unknown }).emails);
    if (!emails || emails.length === 0) { res.status(400).json({ message: "Provide at least one email" }); return; }
    const users = await findUsersByEmails(emails);
    const missing = emails.filter((email) => !users.some((user) => user.email === email));
    if (missing.length) { res.status(404).json({ message: `Users not found: ${missing.join(", ")}` }); return; }
    const members = await addMembers(chatId, users.map((user) => user.id));
    res.status(200).json({ message: "Members added successfully", members: members.map((member) => ({ id: member.user.id, name: member.user.name, email: member.user.email, role: member.role })) });
  } catch (error) {
    console.error("Add members failed", error);
    res.status(500).json({ message: "Could not add members" });
  }
}

export async function deleteGroupMember(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    const targetId = Number(req.params.userId);
    if (!validChatId(chatId) || !isInteger(targetId) || targetId < 1) { res.status(400).json({ message: "Invalid id" }); return; }
    if (!(await adminGroup(chatId, req.user!.id, res))) return;
    if (targetId === req.user!.id) { res.status(400).json({ message: "Use leave to remove yourself" }); return; }
    if (!(await findMember(chatId, targetId))) { res.status(404).json({ message: "Member not found" }); return; }
    await removeMember(chatId, targetId);
    res.status(200).json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Remove member failed", error);
    res.status(500).json({ message: "Could not remove member" });
  }
}

export async function leaveChat(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    if (!validChatId(chatId)) { res.status(400).json({ message: "Invalid chat id" }); return; }
    const chat = await getChat(chatId);
    if (!chat) { res.status(404).json({ message: "Chat not found" }); return; }
    if (chat.type !== ChatType.GROUP) { res.status(400).json({ message: "Only group members can leave" }); return; }
    if (!(await findMember(chatId, req.user!.id))) { res.status(403).json({ message: "You are not a member of this chat" }); return; }
    await leaveGroup(chatId, req.user!.id);
    res.status(200).json({ message: "You left the group successfully" });
  } catch (error) {
    console.error("Leave group failed", error);
    res.status(500).json({ message: "Could not leave group" });
  }
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    if (!validChatId(chatId)) { res.status(400).json({ message: "Invalid chat id" }); return; }
    if (!(await findMember(chatId, req.user!.id))) { res.status(403).json({ message: "You are not a member of this chat" }); return; }
    const members = await getMembers(chatId);
    res.status(200).json({ message: "Members retrieved successfully", members: members.map((member) => ({ id: member.user.id, name: member.user.name, email: member.user.email, role: member.role })) });
  } catch (error) {
    console.error("List members failed", error);
    res.status(500).json({ message: "Could not get members" });
  }
}

export async function renameChat(req: Request, res: Response): Promise<void> {
  try {
    const chatId = chatIdFrom(req);
    const { name } = req.body as { name?: string };
    if (!validChatId(chatId) || !name?.trim()) { res.status(400).json({ message: "A new name is required" }); return; }
    if (!(await adminGroup(chatId, req.user!.id, res))) return;
    const chat = await renameGroup(chatId, name.trim());
    res.status(200).json({ message: "Group renamed successfully", chat });
  } catch (error) {
    console.error("Rename group failed", error);
    res.status(500).json({ message: "Could not rename group" });
  }
}
