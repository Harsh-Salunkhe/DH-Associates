import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// Client creates a new service request
router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, actName, notes } = req.body;

    if (!title) {
      return res.status(400).json({ error: "A title for the request is required" });
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        clientId: req.user!.userId,
        title,
        actName: actName || null,
        notes: notes || null,
      },
    });

    return res.status(201).json(serviceRequest);
  } catch (error) {
    console.error("Create service request error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});
import { upload } from "../lib/upload";
// Client uploads a document to one of their own service requests
router.post("/:id/documents", authenticate, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Ownership check: the request must exist AND belong to this client
    const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }
    if (serviceRequest.clientId !== req.user!.userId) {
      return res.status(403).json({ error: "You can only upload to your own requests" });
    }

    // Record the document, and advance the request status
    const document = await prisma.document.create({
      data: {
        serviceRequestId: id,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
      },
    });

    await prisma.serviceRequest.update({
      where: { id },
      data: { status: "DOCUMENTS_RECEIVED" },
    });

    return res.status(201).json(document);
  } catch (error) {
    console.error("Upload document error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;