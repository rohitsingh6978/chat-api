const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Chat Backend API",
    version: "1.0.0",
    description: "Authentication, direct and group chats, messages, read receipts and last seen. Message storage uses PostgreSQL by default or Firestore when FIREBASE_ENABLED=true."
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
  tags: [
    { name: "Auth" },
    { name: "Chats" },
    { name: "Groups" },
    { name: "Users" }
  ],
  components: {
    parameters: {
      ChatId: { name: "chatId", in: "path", required: true, schema: { type: "integer" } }
    },
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
    },
    schemas: {
      Signup: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Asha" },
          email: { type: "string", format: "email", example: "asha@example.com" },
          password: { type: "string", format: "password", example: "secret123" }
        }
      },
      Login: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "asha@example.com" },
          password: { type: "string", format: "password", example: "secret123" }
        }
      },
      Error: {
        type: "object",
        properties: { message: { type: "string", example: "Invalid request" } }
      },
      GroupCreate: {
        type: "object",
        required: ["name", "emails"],
        properties: {
          name: { type: "string", example: "Project" },
          emails: { type: "array", minItems: 2, items: { type: "string", format: "email" }, example: ["dev@example.com", "lee@example.com"] }
        }
      },
      MessageSend: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string", example: "Hello" }
        }
      }
    }
  },
  paths: {
    "/auth/signup": {
      post: {
        tags: ["Auth"], summary: "Create an account", requestBody: {
          required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Signup" } } }
        }, responses: {
          "201": { description: "Account created" },
          "400": { description: "Missing or invalid fields", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "Email already registered" }
        }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Auth"], summary: "Log in and receive a JWT", requestBody: {
          required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Login" } } }
        }, responses: { "200": { description: "JWT and public user profile" }, "401": { description: "Invalid credentials" } }
      }
    },
    "/chat/create": {
      post: {
        tags: ["Chats"], security: [{ bearerAuth: [] }], summary: "Create or find a direct chat",
        description: "Send an email for the other user, or both IDs (one must match the logged-in user).",
        requestBody: { required: true, content: { "application/json": { schema: { oneOf: [
          { type: "object", required: ["email"], properties: { email: { type: "string", format: "email", example: "dev@example.com" } } },
          { type: "object", required: ["userAId", "userBId"], properties: { userAId: { type: "integer", example: 1 }, userBId: { type: "integer", example: 2 } } }
        ] } } } },
        responses: { "201": { description: "Direct chat created" }, "200": { description: "Existing direct chat returned" }, "404": { description: "User not found" } }
      }
    },
    "/chat/group/create": {
      post: {
        tags: ["Groups"], security: [{ bearerAuth: [] }], summary: "Create a group chat",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/GroupCreate" } } } },
        responses: { "201": { description: "Group created; the caller is ADMIN" }, "400": { description: "Invalid group name or member list" }, "404": { description: "One or more emails were not found" } }
      }
    },
    "/chat/{chatId}/message/send": {
      post: {
        tags: ["Chats"], security: [{ bearerAuth: [] }], summary: "Send a message",
        parameters: [{ $ref: "#/components/parameters/ChatId" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MessageSend" } } } },
        responses: { "201": { description: "Message saved to the configured message store; sender is taken from the JWT" }, "403": { description: "Not a chat member" } }
      }
    },
    "/chat/{chatId}/messages": {
      get: {
        tags: ["Chats"], security: [{ bearerAuth: [] }], summary: "List messages in chronological order",
        parameters: [
          { $ref: "#/components/parameters/ChatId" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 }, description: "Page size (maximum 100)" },
          { name: "before", in: "query", schema: { type: "string", format: "date-time" }, description: "Return messages earlier than this timestamp" }
        ],
        responses: { "200": { description: "Messages" }, "403": { description: "Not a chat member" } }
      }
    },
    "/chat/{chatId}/message/{messageId}/read": {
      post: {
        tags: ["Chats"], security: [{ bearerAuth: [] }], summary: "Mark a message as read",
        parameters: [{ $ref: "#/components/parameters/ChatId" }, { name: "messageId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["userId"], properties: { userId: { type: "integer", example: 2 } } } } } },
        responses: { "200": { description: "Read receipt updated" }, "400": { description: "Sender cannot mark own message as read" }, "404": { description: "Message not found" } }
      }
    },
    "/chat/{chatId}/lastseen": {
      post: {
        tags: ["Chats"], security: [{ bearerAuth: [] }], summary: "Update last-seen message",
        parameters: [{ $ref: "#/components/parameters/ChatId" }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["userId", "messageId"], properties: { userId: { type: "integer", example: 2 }, messageId: { type: "string", example: "message-id" } } } } } },
        responses: { "200": { description: "Last seen updated" }, "404": { description: "Message not found" } }
      }
    },
    "/chat/{chatId}/members": {
      get: {
        tags: ["Groups"], security: [{ bearerAuth: [] }], summary: "List chat members",
        parameters: [{ $ref: "#/components/parameters/ChatId" }],
        responses: { "200": { description: "Member profiles and roles" }, "403": { description: "Not a chat member" } }
      }
    },
    "/chat/{chatId}/members/add": {
      post: {
        tags: ["Groups"], security: [{ bearerAuth: [] }], summary: "Add members (group admins only)",
        parameters: [{ $ref: "#/components/parameters/ChatId" }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["emails"], properties: { emails: { type: "array", minItems: 1, items: { type: "string", format: "email" }, example: ["sam@example.com"] } } } } } },
        responses: { "200": { description: "Updated member list" }, "403": { description: "Admin role required" }, "404": { description: "One or more emails not found" } }
      }
    },
    "/chat/{chatId}/members/{userId}": {
      delete: {
        tags: ["Groups"], security: [{ bearerAuth: [] }], summary: "Remove another member (group admins only)",
        parameters: [{ $ref: "#/components/parameters/ChatId" }, { name: "userId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Member removed" }, "400": { description: "Use leave to remove yourself" }, "403": { description: "Admin role required" }, "404": { description: "Member not found" } }
      }
    },
    "/chat/{chatId}/leave": {
      post: {
        tags: ["Groups"], security: [{ bearerAuth: [] }], summary: "Leave a group",
        parameters: [{ $ref: "#/components/parameters/ChatId" }],
        responses: { "200": { description: "Left group; admin role is transferred when needed" }, "400": { description: "Chat is not a group" } }
      }
    },
    "/chat/{chatId}/rename": {
      patch: {
        tags: ["Groups"], security: [{ bearerAuth: [] }], summary: "Rename a group (group admins only)",
        parameters: [{ $ref: "#/components/parameters/ChatId" }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string", example: "New project name" } } } } } },
        responses: { "200": { description: "Group renamed" }, "403": { description: "Admin role required" } }
      }
    },
    "/user/{userId}/chats": {
      get: {
        tags: ["Users"], security: [{ bearerAuth: [] }], summary: "List the caller's direct and group chats",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Chats with member profile details" }, "403": { description: "Only your own chats can be listed" } }
      }
    }
  }
};

export default openapi;
