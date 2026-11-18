/*
  Warnings:

  - A unique constraint covering the columns `[executionId,agentId,kind,round]` on the table `AgentTask` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExecutionStatus" ADD VALUE 'CLASSIFYING';
ALTER TYPE "ExecutionStatus" ADD VALUE 'ASSESSING';
ALTER TYPE "ExecutionStatus" ADD VALUE 'REVIEWING';
ALTER TYPE "ExecutionStatus" ADD VALUE 'CONSOLIDATING';

-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "reservedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
ADD COLUMN     "reservedTokens" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "AgentTask_executionId_agentId_kind_round_key" ON "AgentTask"("executionId", "agentId", "kind", "round");
