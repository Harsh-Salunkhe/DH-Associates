-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'DOCUMENTS_RECEIVED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "actName" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
