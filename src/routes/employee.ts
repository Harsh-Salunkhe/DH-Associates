import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const employees = await prisma.employeeProfile.findMany({
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(employees);
  } catch (error) {
    console.error("List employees error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

import bcrypt from "bcryptjs";
router.post("/", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, password, name, phone, designation, department } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const employee = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "EMPLOYEE",
        employeeProfile: {
          create: {
            phone: phone || null,
            designation: designation || null,
            department: department || null,
          },
        },
      },
      include: {
        employeeProfile: true,
      },
    });

    return res.status(201).json({
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role,
      employeeProfile: employee.employeeProfile,
    });
  } catch (error) {
    console.error("Create employee error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;