import { FieldValue, Timestamp, type DocumentData, type Query } from "firebase-admin/firestore";
import { prisma } from "../config/db";
import { firebaseEnabled, requireFirestore } from "../config/firebase";

type StoredMessage = {
  id: string;
  senderId: number;
  text: string;
  createdAt: Date | Timestamp;
  readBy: Record<string, Date | Timestamp>;
};

function withReadBy<T extends { reads: { userId: number; readAt: Date }[] }>(message: T) {
  const { reads, ...data } = message;
  return {
    ...data,
    readBy: Object.fromEntries(reads.map((read) => [String(read.userId), read.readAt]))
  };
}

function firestoreMessages(chatId: number) {
  return requireFirestore().collection("chats").doc(String(chatId)).collection("messages");
}

function fromFirestore(id: string, data: DocumentData): StoredMessage {
  return {
    id,
    senderId: Number(data.senderId),
    text: String(data.text),
    createdAt: data.createdAt as Timestamp,
    readBy: (data.readBy ?? {}) as Record<string, Timestamp>
  };
}

export async function saveMessage(chatId: number, senderId: number, text: string) {
  if (firebaseEnabled) {
    const ref = firestoreMessages(chatId).doc();
    await ref.set({ senderId, text, createdAt: FieldValue.serverTimestamp(), readBy: {} });
    const saved = await ref.get();
    return fromFirestore(saved.id, saved.data() ?? {});
  }

  const message = await prisma.message.create({
    data: { chatId, senderId, text },
    include: { reads: true }
  });
  return withReadBy(message);
}

export async function getMessages(chatId: number, limit: number, before?: string) {
  let beforeDate: Date | undefined;
  if (before) {
    beforeDate = new Date(before);
    if (Number.isNaN(beforeDate.getTime())) throw new Error("Invalid before value");
  }

  if (firebaseEnabled) {
    let query: Query<DocumentData> = firestoreMessages(chatId).orderBy("createdAt", "desc").limit(limit);
    if (beforeDate) query = query.where("createdAt", "<", Timestamp.fromDate(beforeDate));
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => fromFirestore(doc.id, doc.data())).reverse();
  }

  const messages = await prisma.message.findMany({
    where: { chatId, ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { reads: true }
  });
  return messages.reverse().map(withReadBy);
}

export async function findMessage(chatId: number, messageId: string) {
  if (firebaseEnabled) {
    const snapshot = await firestoreMessages(chatId).doc(messageId).get();
    return snapshot.exists ? fromFirestore(snapshot.id, snapshot.data() ?? {}) : null;
  }

  return prisma.message.findFirst({ where: { id: messageId, chatId } });
}

export async function markRead(chatId: number, messageId: string, userId: number) {
  if (firebaseEnabled) {
    const ref = firestoreMessages(chatId).doc(messageId);
    await ref.update({ [`readBy.${userId}`]: FieldValue.serverTimestamp() });
    const snapshot = await ref.get();
    return snapshot.exists ? fromFirestore(snapshot.id, snapshot.data() ?? {}) : null;
  }

  const message = await findMessage(chatId, messageId);
  if (!message) return null;
  await prisma.messageRead.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId },
    update: { readAt: new Date() }
  });
  const updated = await prisma.message.findUniqueOrThrow({ where: { id: messageId }, include: { reads: true } });
  return withReadBy(updated);
}

export function setLastSeen(chatId: number, userId: number, messageId: string) {
  if (firebaseEnabled) {
    return requireFirestore().collection("chats").doc(String(chatId)).collection("lastSeen").doc(String(userId)).set({
      messageId,
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  return prisma.chatLastSeen.upsert({
    where: { chatId_userId: { chatId, userId } },
    create: { chatId, userId, messageId },
    update: { messageId, updatedAt: new Date() }
  });
}
