import type { Request, Response } from "express";
import { getUserChats } from "../../model/chat";

export async function listChats(req: Request, res: Response): Promise<void> {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId < 1) {
      res.status(400).json({ message: "Invalid user id" });
      return;
    }
    if (req.user?.id !== userId) {
      res.status(403).json({ message: "You can only view your own chats" });
      return;
    }
    const chats = await getUserChats(userId);
    res.status(200).json({ message: "Chats retrieved successfully", chats: chats.map((chat) => ({
      id: chat.id,
      type: chat.type,
      name: chat.name,
      members: chat.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email
      }))
    })) });
  } catch (error) {
    console.error("List chats failed", error);
    res.status(500).json({ message: "Could not get chats" });
  }
}
