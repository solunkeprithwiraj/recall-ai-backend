-- AlterTable
ALTER TABLE "flashcards" ADD COLUMN     "moduleId" TEXT;

-- CreateTable
CREATE TABLE "study_modules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "educationLevel" TEXT,
    "difficultyLevel" TEXT,
    "estimatedHours" INTEGER,
    "topics" TEXT,
    "learningPlan" TEXT,
    "isAIGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_modules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "study_modules" ADD CONSTRAINT "study_modules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "study_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
