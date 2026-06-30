import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, requireStaff, AuthRequest } from "../middleware/auth";
import path from "path";
import { upload } from "../lib/upload";
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

// Staff (admin or employee) uploads the acknowledgement PDF for a request
router.post("/:id/acknowledgement", authenticate, requireStaff, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }

    const { referenceNo } = req.body;

    const acknowledgement = await prisma.acknowledgement.create({
      data: {
        serviceRequestId: id,
        fileName: req.file.originalname,
        filePath: req.file.path,
        referenceNo: referenceNo || null,
      },
    });

    await prisma.serviceRequest.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    return res.status(201).json(acknowledgement);
  } catch (error) {
    console.error("Upload acknowledgement error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Admin: list ALL service requests (across all clients)
router.get("/", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      include: {
        client: { select: { id: true, name: true, email: true } },
        documents: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(requests);
  } catch (error) {
    console.error("List service requests error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Admin: view one request with its client and documents
router.get("/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const request = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        documents: true,
      },
    });
    if (!request) {
      return res.status(404).json({ error: "Service request not found" });
    }
    return res.status(200).json(request);
  } catch (error) {
    console.error("Get service request error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});



// Admin downloads a specific document
router.get("/documents/:docId/download", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const docId = req.params.docId as string;

    const document = await prisma.document.findUnique({ where: { id: docId } });
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const absolutePath = path.resolve(document.filePath);

    return res.download(absolutePath, document.fileName, (err) => {
      if (err) {
        console.error("Download error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Could not download file" });
        }
      }
    });
  } catch (error) {
    console.error("Download document error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});


// Client downloads their own acknowledgement; staff can download any
router.get("/:id/acknowledgement/download", authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: { acknowledgement: true },
    });

    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }

    // Staff (admin/employee) can access any; a client only their own
    const isStaff = req.user!.role === "ADMIN" || req.user!.role === "EMPLOYEE";
    if (!isStaff && serviceRequest.clientId !== req.user!.userId) {
      return res.status(403).json({ error: "You can only access your own acknowledgement" });
    }

    if (!serviceRequest.acknowledgement) {
      return res.status(404).json({ error: "No acknowledgement issued yet" });
    }

    const absolutePath = path.resolve(serviceRequest.acknowledgement.filePath);
    return res.download(absolutePath, serviceRequest.acknowledgement.fileName);
  } catch (error) {
    console.error("Download acknowledgement error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});
// Admin updates the status of a request
router.patch("/:id/status", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const allowed = ["PENDING", "DOCUMENTS_RECEIVED", "IN_PROGRESS", "COMPLETED"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: "A valid status is required" });
    }

    const existing = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Service request not found" });
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: { status },
      include: {
        client: { select: { id: true, name: true, email: true } },
        documents: true,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Update status error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;