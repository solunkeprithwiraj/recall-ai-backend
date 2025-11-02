import { Router } from "express";
import prisma from "../utils/prisma";
import { getUserIdFromRequest } from "../utils/user";
import { authenticate } from "../middleware/auth";
import { getAIService } from "../services/ai.service";
import { checkAICardsDailyLimit, checkStudyModuleDailyLimit, getDailyUsageSummary } from "../utils/rateLimit";
import type {
  GenerateStudyModuleOptions,
} from "../services/ai.interface";

const router = Router();

/**
 * POST /api/study-modules/ai/generate
 * Generate a complete study module with flashcards using AI
 */
router.post("/ai/generate", authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    console.log(
      `[Study Module Generate] Request received at ${new Date().toISOString()}`
    );
    const userId = getUserIdFromRequest(req);
    const {
      topic,
      subject,
      educationLevel,
      difficultyLevel,
      numberOfCards = 20,
      estimatedHours,
    } = req.body;

    // Check rate limits before processing
    const [studyModuleLimit, aiCardsLimit] = await Promise.all([
      checkStudyModuleDailyLimit(userId),
      checkAICardsDailyLimit(userId, numberOfCards),
    ]);

    // Check study module limit
    if (!studyModuleLimit.allowed) {
      return res.status(429).json({
        error: "Daily rate limit exceeded",
        message: `You have reached your daily limit of ${studyModuleLimit.limit} study modules. Please try again tomorrow.`,
        limit: {
          type: "study_modules",
          current: studyModuleLimit.currentCount,
          limit: studyModuleLimit.limit,
          remaining: 0,
        },
      });
    }

    // Check AI cards limit
    if (!aiCardsLimit.allowed) {
      return res.status(429).json({
        error: "Daily rate limit exceeded",
        message: `You have reached your daily limit of ${aiCardsLimit.limit} AI-generated cards. You currently have ${aiCardsLimit.currentCount} cards today, and this module would create ${numberOfCards} more, which would exceed the limit. Please try again tomorrow or reduce the number of cards.`,
        limit: {
          type: "ai_cards",
          current: aiCardsLimit.currentCount,
          requested: numberOfCards,
          limit: aiCardsLimit.limit,
          remaining: aiCardsLimit.remaining,
        },
      });
    }

    console.log(
      `[Study Module Generate] Generating module for topic: ${topic}`
    );

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return res.status(400).json({
        error: "Topic is required and must be a non-empty string",
      });
    }

    if (topic.length > 200) {
      return res.status(400).json({
        error: "Topic is too long. Maximum length is 200 characters",
      });
    }

    if (numberOfCards && (numberOfCards < 5 || numberOfCards > 100)) {
      return res.status(400).json({
        error: "Number of cards must be between 5 and 100",
      });
    }

    // Generate study module using AI
    const options: GenerateStudyModuleOptions = {
      topic: topic.trim(),
      subject: subject || undefined,
      educationLevel: educationLevel || undefined,
      difficultyLevel: difficultyLevel || undefined,
      numberOfCards: numberOfCards || 20,
      estimatedHours: estimatedHours || undefined,
    };

    console.log(`[Study Module Generate] Calling AI service...`);

    // Set a timeout to catch hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("AI generation timeout after 2 minutes")),
        120000
      );
    });

    const aiService = getAIService();
    const generatedModule = (await Promise.race([
      aiService.generateStudyModule(options),
      timeoutPromise,
    ])) as any;

    console.log(
      `[Study Module Generate] AI generation completed in ${
        Date.now() - startTime
      }ms`
    );

    // Save study module to database
    const savedModule = await prisma.studyModule.create({
      data: {
        userId,
        title: generatedModule.module.title,
        description: generatedModule.module.description,
        subject: options.subject || null,
        educationLevel: options.educationLevel || null,
        difficultyLevel: options.difficultyLevel || null,
        estimatedHours: generatedModule.module.estimatedHours,
        topics: JSON.stringify(generatedModule.module.topics),
        learningPlan: JSON.stringify(generatedModule.module.learningPlan),
        isAIGenerated: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        educationLevel: true,
        difficultyLevel: true,
        estimatedHours: true,
        topics: true,
        learningPlan: true,
        isAIGenerated: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Save all flashcards linked to the module
    const savedFlashcards = await Promise.all(
      generatedModule.flashcards.map((card: any) =>
        prisma.flashcard.create({
          data: {
            userId,
            question: card.question,
            answer: card.answer,
            subject: options.subject || null,
            difficultyLevel:
              card.difficultyLevel || options.difficultyLevel || null,
            educationLevel: options.educationLevel || null,
            moduleId: savedModule.id,
            questionType: card.questionType || null,
            options: card.options ? JSON.stringify(card.options) : null,
            isAIGenerated: true, // Mark as AI-generated
          },
          select: {
            id: true,
            question: true,
            answer: true,
            subject: true,
            difficultyLevel: true,
            educationLevel: true,
            moduleId: true,
            questionType: true,
            options: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      )
    );

    const responseTime = Date.now() - startTime;
    console.log(
      `[Study Module Generate] Request completed successfully in ${responseTime}ms`
    );
    return res.status(201).json({
      message: "Study module generated successfully",
      module: {
        ...savedModule,
        topics: JSON.parse(savedModule.topics || "[]"),
        learningPlan: JSON.parse(savedModule.learningPlan || "[]"),
      },
      flashcards: savedFlashcards.map((card) => ({
        ...card,
        options: card.options ? JSON.parse(card.options) : null,
      })),
      stats: {
        totalFlashcards: savedFlashcards.length,
        estimatedHours: savedModule.estimatedHours,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(
      `[Study Module Generate] Error after ${responseTime}ms:`,
      error
    );

    return res.status(500).json({
      error: "Failed to generate study module",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/study-modules/ai/preview
 * Preview a study module without saving to database
 */
router.post("/ai/preview", async (req, res) => {
  const startTime = Date.now();
  try {
    console.log(
      `[Study Module Preview] Request received at ${new Date().toISOString()}`
    );
    const {
      topic,
      subject,
      educationLevel,
      difficultyLevel,
      numberOfCards = 20,
      estimatedHours,
    } = req.body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return res.status(400).json({
        error: "Topic is required and must be a non-empty string",
      });
    }

    if (numberOfCards && (numberOfCards < 5 || numberOfCards > 100)) {
      return res.status(400).json({
        error: "Number of cards must be between 5 and 100",
      });
    }

    console.log(
      `[Study Module Preview] Generating preview for topic: ${topic}`
    );
    const options: GenerateStudyModuleOptions = {
      topic: topic.trim(),
      subject: subject || undefined,
      educationLevel: educationLevel || undefined,
      difficultyLevel: difficultyLevel || undefined,
      numberOfCards: numberOfCards || 20,
      estimatedHours: estimatedHours || undefined,
    };

    console.log(`[Study Module Preview] Calling AI service...`);
    const aiService = getAIService();
    const moduleData = await aiService.generateStudyModule(options);
    const responseTime = Date.now() - startTime;
    console.log(
      `[Study Module Preview] Preview generation completed successfully in ${responseTime}ms`
    );
    return res.json({
      message: "Study module preview generated successfully",
      module: moduleData.module,
      flashcards: moduleData.flashcards,
      stats: {
        totalFlashcards: moduleData.flashcards.length,
        estimatedHours: moduleData.module.estimatedHours,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(
      `[Study Module Preview] Error after ${responseTime}ms:`,
      error
    );

    return res.status(500).json({
      error: "Failed to generate study module preview",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/study-modules
 * Get all study modules for the user
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    const modules = await prisma.studyModule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { flashcards: true },
        },
        progress: {
          where: { userId },
          select: {
            currentCardIndex: true,
            cardsStudied: true,
            totalCorrect: true,
            accuracy: true,
            completedAt: true,
            lastStudiedAt: true,
          },
        },
      },
    });

    return res.json({
      modules: modules.map((module) => {
        const progress = module.progress[0] || null;
        const totalCards = module._count.flashcards;
        const progressPercent = totalCards > 0 && progress
          ? Math.round(((progress.currentCardIndex + 1) / totalCards) * 100)
          : 0;

        return {
          id: module.id,
          title: module.title,
          description: module.description,
          subject: module.subject,
          educationLevel: module.educationLevel,
          difficultyLevel: module.difficultyLevel,
          estimatedHours: module.estimatedHours,
          topics: JSON.parse(module.topics || "[]"),
          learningPlan: JSON.parse(module.learningPlan || "[]"),
          isAIGenerated: module.isAIGenerated,
          createdAt: module.createdAt,
          updatedAt: module.updatedAt,
          flashcardCount: totalCards,
          progress: progress ? {
            currentCardIndex: progress.currentCardIndex,
            cardsStudied: progress.cardsStudied,
            totalCorrect: progress.totalCorrect,
            accuracy: progress.accuracy ? Math.round(progress.accuracy * 100) : 0, // Convert to percentage
            completedAt: progress.completedAt,
            lastStudiedAt: progress.lastStudiedAt,
            progressPercent,
            isCompleted: !!progress.completedAt,
          } : null,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching study modules:", error);
    return res.status(500).json({ error: "Failed to fetch study modules" });
  }
});

/**
 * GET /api/study-modules/:id
 * Get a specific study module with its flashcards
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    const module = await prisma.studyModule.findFirst({
      where: { id, userId },
      include: {
        flashcards: {
          select: {
            id: true,
            question: true,
            answer: true,
            subject: true,
            difficultyLevel: true,
            educationLevel: true,
            questionType: true,
            options: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        progress: {
          where: { userId },
          select: {
            currentCardIndex: true,
            cardsStudied: true,
            totalCorrect: true,
            accuracy: true,
            completedAt: true,
            lastStudiedAt: true,
          },
        },
      },
    });

    if (!module) {
      return res.status(404).json({ error: "Study module not found" });
    }

    const progress = module.progress[0] || null;
    const totalCards = module.flashcards.length;
    const progressPercent = totalCards > 0 && progress
      ? Math.round(((progress.currentCardIndex + 1) / totalCards) * 100)
      : 0;

    return res.json({
      module: {
        ...module,
        topics: JSON.parse(module.topics || "[]"),
        learningPlan: JSON.parse(module.learningPlan || "[]"),
        progress: progress ? {
          currentCardIndex: progress.currentCardIndex,
          cardsStudied: progress.cardsStudied,
          totalCorrect: progress.totalCorrect,
          accuracy: progress.accuracy ? Math.round(progress.accuracy * 100) : 0, // Convert to percentage
          completedAt: progress.completedAt,
          lastStudiedAt: progress.lastStudiedAt,
          progressPercent,
          isCompleted: !!progress.completedAt,
        } : null,
      },
      flashcards: module.flashcards.map((card) => ({
        ...card,
        options: card.options ? JSON.parse(card.options) : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching study module:", error);
    return res.status(500).json({ error: "Failed to fetch study module" });
  }
});

/**
 * DELETE /api/study-modules/:id
 * Delete a study module (cascades to flashcards)
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    // Check if module exists and belongs to user
    const existing = await prisma.studyModule.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Study module not found" });
    }

    await prisma.studyModule.delete({
      where: { id },
    });

    return res.json({ message: "Study module deleted successfully" });
  } catch (error) {
    console.error("Error deleting study module:", error);
    return res.status(500).json({ error: "Failed to delete study module" });
  }
});

export default router;
