import "dotenv/config";
import express from "express";
import authRoutes from "./src/api/auth/routes";
import chatRoutes from "./src/api/chat/routes";
import userRoutes from "./src/api/user/routes";
import swaggerUi from "swagger-ui-express";
import openapi from "./src/config/openapi";
import { authenticate } from "./src/middleware/authentication";
import { apiResponseEnvelope } from "./src/middleware/apiResponse";
import { prisma } from "./src/config/db";

const app = express();
app.use(express.json());
app.use(apiResponseEnvelope);
app.use("/auth", authRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.use("/chat", authenticate, chatRoutes);
app.use("/user", authenticate, userRoutes);

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    console.log("Checking database connection...");
    await prisma.$connect();
    console.log("Database connected successfully");
    app.listen(port, () => console.log(`Server listening on ${port}`));
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exitCode = 1;
  }
}

void start();
