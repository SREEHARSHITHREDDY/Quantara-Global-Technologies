-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "providerKey" TEXT,
ADD COLUMN     "templateId" TEXT;
