import { Router } from "express";
import prisma from "../utils/prisma";
import { getUserIdFromRequest } from "../utils/user";
import { authenticate } from "../middleware/auth";

const router = Router();

// Get all flashcards for a user
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    const flashcards = await prisma.flashcard.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        question: true,
        answer: true,
        subject: true,
        difficultyLevel: true,
        educationLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ flashcards });
  } catch (error) {
    console.error("Error fetching flashcards:", error);
    return res.status(500).json({ error: "Failed to fetch flashcards" });
  }
});

// Create a new flashcard
router.post("/", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { question, answer, subject, difficultyLevel, educationLevel } =
      req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ error: "Question and answer are required" });
    }

    const flashcard = await prisma.flashcard.create({
      data: {
        userId,
        question,
        answer,
        subject: subject || null,
        difficultyLevel: difficultyLevel || null,
        educationLevel: educationLevel || null,
      },
      select: {
        id: true,
        question: true,
        answer: true,
        subject: true,
        difficultyLevel: true,
        educationLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({ flashcard });
  } catch (error) {
    console.error("Error creating flashcard:", error);
    return res.status(500).json({ error: "Failed to create flashcard" });
  }
});

// Get a single flashcard by ID
router.get("/:id", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    const flashcard = await prisma.flashcard.findFirst({
      where: { id, userId },
      select: {
        id: true,
        question: true,
        answer: true,
        subject: true,
        difficultyLevel: true,
        educationLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!flashcard) {
      return res.status(404).json({ error: "Flashcard not found" });
    }

    return res.json({ flashcard });
  } catch (error) {
    console.error("Error fetching flashcard:", error);
    return res.status(500).json({ error: "Failed to fetch flashcard" });
  }
});

// Update a flashcard
router.put("/:id", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;
    const { question, answer, subject, difficultyLevel, educationLevel } =
      req.body;

    // Check if flashcard exists and belongs to user
    const existing = await prisma.flashcard.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Flashcard not found" });
    }

    const flashcard = await prisma.flashcard.update({
      where: { id },
      data: {
        ...(question && { question }),
        ...(answer && { answer }),
        ...(subject !== undefined && { subject: subject || null }),
        ...(difficultyLevel !== undefined && {
          difficultyLevel: difficultyLevel || null,
        }),
        ...(educationLevel !== undefined && {
          educationLevel: educationLevel || null,
        }),
      },
      select: {
        id: true,
        question: true,
        answer: true,
        subject: true,
        difficultyLevel: true,
        educationLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ flashcard });
  } catch (error) {
    console.error("Error updating flashcard:", error);
    return res.status(500).json({ error: "Failed to update flashcard" });
  }
});

// Delete a flashcard
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    // Check if flashcard exists and belongs to user
    const existing = await prisma.flashcard.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Flashcard not found" });
    }

    await prisma.flashcard.delete({
      where: { id },
    });

    return res.json({ message: "Flashcard deleted successfully" });
  } catch (error) {
    console.error("Error deleting flashcard:", error);
    return res.status(500).json({ error: "Failed to delete flashcard" });
  }
});

export default router;
