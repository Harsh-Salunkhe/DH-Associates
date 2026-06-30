import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const client = await prisma.user.create({
      data: { email, name, passwordHash, role: "CLIENT" },
    });
    return res.status(201).json({
      id: client.id, email: client.email, name: client.name, role: client.role,
    });
  } catch (error) {
    console.error("Create client error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;