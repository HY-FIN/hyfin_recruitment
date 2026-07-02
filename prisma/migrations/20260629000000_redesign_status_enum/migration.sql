-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('SUBMITTED', 'DOC_REVIEWING', 'DOC_COMPLETED', 'INTERVIEW_READY', 'INTERVIEW_SET', 'FINISHED');

-- CreateEnum
CREATE TYPE "DocResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "FinalResult" AS ENUM ('PASS', 'FAIL');

-- AlterTable
ALTER TABLE "Applicant" DROP COLUMN "docEmailSent",
DROP COLUMN "finalEmailSent",
DROP COLUMN "interviewEmailSent",
DROP COLUMN "receiptEmailSent",
DROP COLUMN "status",
ADD COLUMN     "docResult" "DocResult",
ADD COLUMN     "finalResult" "FinalResult",
ADD COLUMN     "stage" "ApplicationStage" NOT NULL DEFAULT 'SUBMITTED';
