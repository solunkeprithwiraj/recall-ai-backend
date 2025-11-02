import { Router } from "express";
import prisma from "../utils/prisma";
import { getUserIdFromRequest } from "../utils/user";
import { authenticate } from "../middleware/auth";

const router = Router();

// Start a new study session
router.post("/session", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { sessionType = "review", moduleId } = req.body;

    console.log(`Creating study session for user: ${userId}, module: ${moduleId || 'all'}`);

    // Create a new study session
    const session = await prisma.studySession.create({
      data: {
        userId,
        sessionType,
      },
      select: {
        id: true,
        userId: true,
        sessionType: true,
        cardsStudied: true,
        correctAnswers: true,
        startedAt: true,
      },
    });

    // Get flashcards for this session
    // If moduleId is provided, filter by that module
    // If not, get all user flashcards (for backward compatibility)
    const whereClause: any = { userId };
    if (moduleId) {
      whereClause.moduleId = moduleId;
    }

    const flashcards = await prisma.flashcard.findMany({
      where: whereClause,
      select: {
        id: true,
        question: true,
        answer: true,
        subject: true,
        difficultyLevel: true,
        moduleId: true,
        questionType: true,
        options: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Check for existing progress if moduleId is provided
    let startIndex = 0;
    let progress = null;
    if (moduleId && flashcards.length > 0) {
      progress = await prisma.moduleProgress.findUnique({
        where: {
          userId_moduleId: {
            userId,
            moduleId,
          },
        },
      });

      if (progress) {
        // Resume from where user left off (start from next card after last studied)
        startIndex = progress.currentCardIndex + 1;
        // Don't go beyond the flashcards array
        if (startIndex >= flashcards.length) {
          startIndex = flashcards.length - 1;
        }
      }
    }

    return res.status(201).json({
      session,
      flashcards: flashcards.map(card => ({
        ...card,
        options: card.options ? JSON.parse(card.options) : null,
      })),
      startIndex, // Index to start from (for resuming)
      progress: progress ? {
        currentCardIndex: progress.currentCardIndex,
        cardsStudied: progress.cardsStudied,
        totalCorrect: progress.totalCorrect,
        accuracy: progress.accuracy,
        completedAt: progress.completedAt,
      } : null,
    });
  } catch (error) {
    console.error("Error starting study session:", error);
    return res.status(500).json({ error: "Failed to start study session" });
  }
});

// Submit an answer for a card
router.post("/performance/:cardId", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { cardId } = req.params;
    const { correct, responseTime } = req.body;

    // Check if card exists
    const card = await prisma.flashcard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }

    // Record card performance
    const performance = await prisma.cardPerformance.create({
      data: {
        userId,
        cardId,
        isCorrect: correct !== undefined ? correct : null,
        responseTime: responseTime || null,
        reviewCount: 1,
      },
      select: {
        id: true,
        isCorrect: true,
        responseTime: true,
        reviewCount: true,
        createdAt: true,
      },
    });

    return res.json({ performance });
  } catch (error) {
    console.error("Error recording performance:", error);
    return res.status(500).json({ error: "Failed to record performance" });
  }
});

// Get a study session
router.get("/session/:id", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    const session = await prisma.studySession.findFirst({
      where: { id, userId },
      select: {
        id: true,
        sessionType: true,
        cardsStudied: true,
        correctAnswers: true,
        sessionDuration: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({ session });
  } catch (error) {
    console.error("Error fetching session:", error);
    return res.status(500).json({ error: "Failed to fetch session" });
  }
});

// Update session when ending
router.put("/session/:id", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;
    const { cardsStudied, correctAnswers, sessionDuration, moduleId, currentCardIndex } = req.body;

    const session = await prisma.studySession.update({
      where: { id },
      data: {
        cardsStudied: cardsStudied || 0,
        correctAnswers: correctAnswers || 0,
        sessionDuration: sessionDuration || null,
        completedAt: new Date(),
      },
      select: {
        id: true,
        cardsStudied: true,
        correctAnswers: true,
        sessionDuration: true,
        completedAt: true,
      },
    });

    // Update module progress if moduleId is provided
    if (moduleId) {
      // Get total number of flashcards in the module
      const totalCards = await prisma.flashcard.count({
        where: { moduleId, userId },
      });

      // Get or create progress record
      let progress = await prisma.moduleProgress.findUnique({
        where: {
          userId_moduleId: {
            userId,
            moduleId,
          },
        },
      });

      const newCardsStudied = cardsStudied || 0;
      const newCorrectAnswers = correctAnswers || 0;
      const finalCardIndex = currentCardIndex !== undefined ? currentCardIndex : (progress?.currentCardIndex || 0);

      // Calculate new totals
      const updatedCardsStudied = (progress?.cardsStudied || 0) + newCardsStudied;
      const updatedTotalCorrect = (progress?.totalCorrect || 0) + newCorrectAnswers;
      const accuracy = updatedCardsStudied > 0 ? updatedTotalCorrect / updatedCardsStudied : 0;
      const isCompleted = finalCardIndex >= totalCards - 1;

      if (progress) {
        // Update existing progress
        progress = await prisma.moduleProgress.update({
          where: {
            userId_moduleId: {
              userId,
              moduleId,
            },
          },
          data: {
            currentCardIndex: finalCardIndex,
            cardsStudied: updatedCardsStudied,
            totalCorrect: updatedTotalCorrect,
            accuracy,
            lastStudiedAt: new Date(),
            completedAt: isCompleted && !progress.completedAt ? new Date() : progress.completedAt,
          },
        });
      } else {
        // Create new progress record
        progress = await prisma.moduleProgress.create({
          data: {
            userId,
            moduleId,
            currentCardIndex: finalCardIndex,
            cardsStudied: updatedCardsStudied,
            totalCorrect: updatedTotalCorrect,
            accuracy,
            lastStudiedAt: new Date(),
            completedAt: isCompleted ? new Date() : null,
          },
        });
      }

      return res.json({ 
        session,
        progress: {
          currentCardIndex: progress.currentCardIndex,
          cardsStudied: progress.cardsStudied,
          totalCorrect: progress.totalCorrect,
          accuracy: progress.accuracy,
          completedAt: progress.completedAt,
        },
      });
    }

    return res.json({ session });
  } catch (error) {
    console.error("Error updating session:", error);
    return res.status(500).json({ error: "Failed to update session" });
  }
});

// Get study progress/stats
router.get("/history", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    // Get recent study sessions
    const sessions = await prisma.studySession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        sessionType: true,
        cardsStudied: true,
        correctAnswers: true,
        sessionDuration: true,
        startedAt: true,
        completedAt: true,
      },
    });

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySessions = await prisma.studySession.findMany({
      where: {
        userId,
        startedAt: {
          gte: today,
        },
        completedAt: {
          not: null,
        },
      },
    });

    const studiedToday = todaySessions.reduce(
      (sum, s) => sum + s.cardsStudied,
      0
    );

    return res.json({
      sessions,
      studiedToday,
    });
  } catch (error) {
    console.error("Error fetching study history:", error);
    return res.status(500).json({ error: "Failed to fetch study history" });
  }
});

export default router;
