import { Router } from "express";
import {
  addGroupMembers, createDirect, createGroupChat, deleteGroupMember, leaveChat,
  listMembers, listMessages, markMessageRead, renameChat, sendMessage, updateLastSeen
} from "./controller";

const router = Router();
router.post("/group/create", createGroupChat);
router.post("/create", createDirect);
router.post("/:chatId/members/add", addGroupMembers);
router.delete("/:chatId/members/:userId", deleteGroupMember);
router.post("/:chatId/leave", leaveChat);
router.get("/:chatId/members", listMembers);
router.patch("/:chatId/rename", renameChat);
router.post("/:chatId/message/send", sendMessage);
router.get("/:chatId/messages", listMessages);
router.post("/:chatId/message/:messageId/read", markMessageRead);
router.post("/:chatId/lastseen", updateLastSeen);
export default router;
