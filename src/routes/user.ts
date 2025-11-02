import { Router } from "express";
import prisma from "../utils/prisma";
import { getUserIdFromRequest } from "../utils/user";
import { authenticate } from "../middleware/auth";

const router = Router();

// Get user profile
router.get("/profile", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        educationLevel: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Update user profile
router.put("/profile", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { name, age, educationLevel } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(age !== undefined && { age }),
        ...(educationLevel && { educationLevel }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        educationLevel: true,
        updatedAt: true,
      },
    });

    return res.json({ user });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({ error: "Failed to update user profile" });
  }
});

// Get user stats for dashboard
router.get("/stats", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    // Get total cards
    const totalCards = await prisma.flashcard.count({
      where: { userId },
    });

    // Get today's study stats
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

    // Calculate accuracy from recent sessions
    const recentSessions = await prisma.studySession.findMany({
      where: {
        userId,
        completedAt: {
          not: null,
        },
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    let totalCorrect = 0;
    let totalStudied = 0;
    recentSessions.forEach((session) => {
      totalCorrect += session.correctAnswers;
      totalStudied += session.cardsStudied;
    });

    const accuracy =
      totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0;

    // Calculate streak (simplified - consecutive days with study sessions)
    // This is a simplified version - you might want to improve this logic
    const allSessions = await prisma.studySession.findMany({
      where: {
        userId,
        completedAt: {
          not: null,
        },
      },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });

    let streak = 0;
    if (allSessions.length > 0) {
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      for (const session of allSessions) {
        const sessionDate = new Date(session.startedAt);
        sessionDate.setHours(0, 0, 0, 0);

        if (sessionDate.getTime() === checkDate.getTime()) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (sessionDate.getTime() < checkDate.getTime()) {
          break;
        }
      }
    }

    return res.json({
      totalCards,
      studiedToday,
      streak,
      accuracy,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

export default router;
