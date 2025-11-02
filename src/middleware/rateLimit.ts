import { Request, Response, NextFunction } from "express";
import { checkStudyModuleDailyLimit, checkAICardsDailyLimit } from "../utils/rateLimit";
import { getUserIdFromRequest } from "../utils/user";

/**
 * Middleware to check daily rate limit for study module creation
 */
export const checkStudyModuleRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserIdFromRequest(req);
    
    const limitCheck = await checkStudyModuleDailyLimit(userId);

    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: "Daily rate limit exceeded",
        message: `You have reached your daily limit of ${limitCheck.limit} study modules. Please try again tomorrow.`,
        limit: {
          type: "study_modules",
          current: limitCheck.currentCount,
          limit: limitCheck.limit,
          remaining: 0,
          resetTime: getResetTime(),
        },
      });
    }

    // Attach limit info to request for potential use in response
    req.rateLimitInfo = {
      type: "study_modules",
      remaining: limitCheck.remaining,
    };

    return next();
  } catch (error) {
    console.error("Error checking study module rate limit:", error);
    return res.status(500).json({
      error: "Failed to check rate limit",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Middleware to check daily rate limit for AI card creation
 */
export const checkAICardsRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserIdFromRequest(req);
    
    // Get the number of cards requested from the request body
    const numberOfCards = req.body.numberOfCards || 5; // Default to 5 if not specified
    
    const limitCheck = await checkAICardsDailyLimit(userId, numberOfCards);

    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: "Daily rate limit exceeded",
        message: `You have reached your daily limit of ${limitCheck.limit} AI-generated cards. You currently have ${limitCheck.currentCount} cards today, and attempted to create ${limitCheck.requestedCount} more, which would exceed the limit. Please try again tomorrow.`,
        limit: {
          type: "ai_cards",
          current: limitCheck.currentCount,
          requested: limitCheck.requestedCount,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
          resetTime: getResetTime(),
        },
      });
    }

    // Attach limit info to request for potential use in response
    req.rateLimitInfo = {
      type: "ai_cards",
      remaining: limitCheck.remaining - limitCheck.requestedCount,
    };

    return next();
  } catch (error) {
    console.error("Error checking AI cards rate limit:", error);
    return res.status(500).json({
      error: "Failed to check rate limit",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get the reset time (start of next day in UTC)
 */
function getResetTime(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return tomorrow.toISOString();
}

// Extend Express Request type to include rateLimitInfo
declare global {
  namespace Express {
    interface Request {
      rateLimitInfo?: {
        type: "study_modules" | "ai_cards";
        remaining: number;
      };
    }
  }
}

