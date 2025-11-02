/*
  Warnings:

  - Added the required column `password` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Add password column as nullable first
ALTER TABLE "users" ADD COLUMN "password" TEXT;

-- Set a temporary password for existing users (they'll need to reset it)
UPDATE "users" SET "password" = '$2a$10$temp_placeholder_password_for_reset' WHERE "password" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL;
