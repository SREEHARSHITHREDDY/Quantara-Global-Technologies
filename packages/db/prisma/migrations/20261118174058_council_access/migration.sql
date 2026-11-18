-- CreateEnum
CREATE TYPE "CouncilPlan" AS ENUM ('DISABLED', 'TRIAL', 'STANDARD', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "councilMaxConcurrent" INTEGER,
ADD COLUMN     "councilPlan" "CouncilPlan" NOT NULL DEFAULT 'DISABLED',
ADD COLUMN     "councilTrialEndsAt" TIMESTAMP(3);
