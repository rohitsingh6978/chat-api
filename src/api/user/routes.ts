import { Router } from "express";
import { listChats } from "./controller";

const router = Router();
router.get("/:userId/chats", listChats);
export default router;
