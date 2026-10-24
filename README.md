# Chat backend

A chat API built with Express, TypeScript, Prisma, and PostgreSQL. Users, chats, and memberships are stored in PostgreSQL. Set `FIREBASE_ENABLED=true` to store messages, read receipts, and last-seen data in Firestore instead. The API does not provide a WebSocket connection.

## Setup

You need Node.js 24 or newer and a running PostgreSQL server.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`. Keep `FIREBASE_ENABLED=false` to store messages in PostgreSQL. To use Firestore, set it to `true` and fill in the Firebase service-account values.

3. Generate Prisma Client and apply the migrations:

   ```sh
   npx prisma generate
   npx prisma migrate deploy
   ```

4. Start the server:

   ```sh
   npx tsx index.ts
   ```

The API runs at `http://localhost:3000`. Swagger docs are at `http://localhost:3000/api-docs`.

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign login tokens |
| `PORT` | Server port; defaults to `3000` |
| `FIREBASE_ENABLED` | Set to `true` to store messages, read receipts, and last-seen data in Firestore; defaults to PostgreSQL when false or unset |
| `FIREBASE_PROJECT_ID` | Firebase project ID; required when Firebase is enabled |
| `FIREBASE_CLIENT_EMAIL` | Firebase service-account email; required when Firebase is enabled |
| `FIREBASE_PRIVATE_KEY` | Firebase service-account private key; required when Firebase is enabled; keep `\n` line breaks escaped |

Example connection string:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/chat?schema=public"
JWT_SECRET="change-this-secret"
PORT=3000
FIREBASE_ENABLED=false
# Add these only when FIREBASE_ENABLED=true
# FIREBASE_PROJECT_ID="your-firebase-project-id"
# FIREBASE_CLIENT_EMAIL="firebase-adminsdk@example.iam.gserviceaccount.com"
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## API routes

Login and signup are public. All `/chat` and `/user` routes require a bearer token from `/auth/login`.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/auth/signup` | Create an account |
| POST | `/auth/login` | Log in |
| POST | `/chat/create` | Create or find a direct chat |
| POST | `/chat/group/create` | Create a group chat |
| POST | `/chat/:chatId/message/send` | Send a message; body: `{ "text": "Hello" }` |
| GET | `/chat/:chatId/messages` | Get chat messages |
| POST | `/chat/:chatId/message/:messageId/read` | Mark a message as read |
| POST | `/chat/:chatId/lastseen` | Update last-seen message |
| GET | `/chat/:chatId/members` | List chat members |
| POST | `/chat/:chatId/members/add` | Add group members |
| DELETE | `/chat/:chatId/members/:userId` | Remove a group member |
| POST | `/chat/:chatId/leave` | Leave a group |
| PATCH | `/chat/:chatId/rename` | Rename a group |
| GET | `/user/:userId/chats` | List a user's chats |

API responses use this shape:

```json
{
  "status": true,
  "message": "Login successful",
  "data": {}
}
```

## Scripts

```sh
npm run dev
npm run build
npm start
npm run prisma:generate
npm run prisma:migrate
```
