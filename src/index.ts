import "dotenv/config";
import express from "express";
import prisma from "./lib/prisma";
import authRoutes from "./routes/auth";
import { authenticate, requireAdmin, AuthRequest } from "./middleware/auth";
const app = express();
const PORT = 4000;

app.use(express.json());
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => {
  res.json({ message: "DH Associates API is running" });
});

app.get("/health", async (req, res) => {
  const userCount = await prisma.user.count();
  res.json({ status: "ok", users: userCount });
});

app.get("/api/me", authenticate, (req: AuthRequest, res) => {
  res.json({ message: "You are authenticated", user: req.user });
});

app.get("/api/admin-only", authenticate, requireAdmin, (req: AuthRequest, res) => {
  res.json({ message: "Welcome, admin" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});