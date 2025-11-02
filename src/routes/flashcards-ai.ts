import { Router } from "express";
import prisma from "../utils/prisma";
import { getUserIdFromRequest } from "../utils/user";
import { authenticate } from "../middleware/auth";
import { getAIService } from "../services/ai.service";
import type {
  GenerateFlashcardsOptions,
  GenerateFlashcardsFromTopicOptions,
} from "../services/ai.interface";

const router = Router();

/**
 * POST /api/flashcards-ai/generate
 * Generate flashcards from text content using Vertex AI
 */
router.post("/generate", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const {
      content,
      subject,
      educationLevel,
      difficultyLevel,
      numberOfCards = 5,
      questionTypes,
    } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({
        error: "Content is required and must be a non-empty string",
      });
    }

    if (content.length > 50000) {
      return res.status(400).json({
        error: "Content is too long. Maximum length is 50,000 characters",
      });
    }

    // Generate flashcards using AI service
    const options: GenerateFlashcardsOptions = {
      content: content.trim(),
      subject: subject || undefined,
      educationLevel: educationLevel || undefined,
      difficultyLevel: difficultyLevel || undefined,
      numberOfCards: numberOfCards || 5,
      questionTypes: questionTypes || undefined,
    };

    const aiService = getAIService();
    const generatedFlashcards = await aiService.generateFlashcards(options);

    // Save generated flashcards to database
    const savedFlashcards = await Promise.all(
      generatedFlashcards.map((card) =>
        prisma.flashcard.create({
          data: {
            userId,
            question: card.question,
            answer: card.answer,
            subject: options.subject || null,
            difficultyLevel: card.difficultyLevel || options.difficultyLevel || null,
            educationLevel: options.educationLevel || null,
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
        })
      )
    );

    return res.status(201).json({
      message: "Flashcards generated successfully",
      count: savedFlashcards.length,
      flashcards: savedFlashcards,
    });
  } catch (error) {
    console.error("Error generating flashcards with AI:", error);
    
    return res.status(500).json({
      error: "Failed to generate flashcards",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/flashcards-ai/preview
 * Generate flashcards preview without saving to database
 */
router.post("/preview", async (req, res) => {
  try {
    const {
      content,
      subject,
      educationLevel,
      difficultyLevel,
      numberOfCards = 5,
      questionTypes,
    } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({
        error: "Content is required and must be a non-empty string",
      });
    }

    if (content.length > 50000) {
      return res.status(400).json({
        error: "Content is too long. Maximum length is 50,000 characters",
      });
    }

    const options: GenerateFlashcardsOptions = {
      content: content.trim(),
      subject: subject || undefined,
      educationLevel: educationLevel || undefined,
      difficultyLevel: difficultyLevel || undefined,
      numberOfCards: numberOfCards || 5,
      questionTypes: questionTypes || undefined,
    };

    const aiService = getAIService();
    const flashcards = await aiService.generateFlashcards(options);

    return res.json({
      message: "Flashcards preview generated successfully",
      count: flashcards.length,
      flashcards,
    });
  } catch (error) {
    console.error("Error generating flashcards preview:", error);

    return res.status(500).json({
      error: "Failed to generate flashcards preview",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/flashcards-ai/generate-from-topic
 * Generate flashcards from a topic/subject using AI (simpler than content-based)
 */
router.post("/generate-from-topic", authenticate, async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const {
      topic,
      subject,
      educationLevel,
      difficultyLevel,
      numberOfCards = 10,
      questionTypes,
    } = req.body;

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

    if (numberOfCards && (numberOfCards < 1 || numberOfCards > 50)) {
      return res.status(400).json({
        error: "Number of cards must be between 1 and 50",
      });
    }

    // Generate flashcards from topic using AI
    const options: GenerateFlashcardsFromTopicOptions = {
      topic: topic.trim(),
      subject: subject || undefined,
      educationLevel: educationLevel || undefined,
      difficultyLevel: difficultyLevel || undefined,
      numberOfCards: numberOfCards || 10,
      questionTypes: questionTypes || undefined,
    };

    const aiService = getAIService();
    const generatedFlashcards = await aiService.generateFlashcardsFromTopic(options);

    // Save generated flashcards to database
    const savedFlashcards = await Promise.all(
      generatedFlashcards.map((card) =>
        prisma.flashcard.create({
          data: {
            userId,
            question: card.question,
            answer: card.answer,
            subject: options.subject || null,
            difficultyLevel: card.difficultyLevel || options.difficultyLevel || null,
            educationLevel: options.educationLevel || null,
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
        })
      )
    );

    return res.status(201).json({
      message: "Flashcards generated from topic successfully",
      count: savedFlashcards.length,
      flashcards: savedFlashcards,
    });
  } catch (error) {
    console.error("Error generating flashcards from topic with AI:", error);

    return res.status(500).json({
      error: "Failed to generate flashcards from topic",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/flashcards-ai/preview-from-topic
 * Preview flashcards from a topic without saving to database
 */
router.post("/preview-from-topic", async (req, res) => {
  try {
    const {
      topic,
      subject,
      educationLevel,
      difficultyLevel,
      numberOfCards = 10,
      questionTypes,
    } = req.body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return res.status(400).json({
        error: "Topic is required and must be a non-empty string",
      });
    }

    if (numberOfCards && (numberOfCards < 1 || numberOfCards > 50)) {
      return res.status(400).json({
        error: "Number of cards must be between 1 and 50",
      });
    }

    const options: GenerateFlashcardsFromTopicOptions = {
      topic: topic.trim(),
      subject: subject || undefined,
      educationLevel: educationLevel || undefined,
      difficultyLevel: difficultyLevel || undefined,
      numberOfCards: numberOfCards || 10,
      questionTypes: questionTypes || undefined,
    };

    const aiService = getAIService();
    const flashcards = await aiService.generateFlashcardsFromTopic(options);

    return res.json({
      message: "Flashcards preview generated successfully",
      count: flashcards.length,
      flashcards,
    });
  } catch (error) {
    console.error("Error generating flashcards preview from topic:", error);

    return res.status(500).json({
      error: "Failed to generate flashcards preview from topic",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
