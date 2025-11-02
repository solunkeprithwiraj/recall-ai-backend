import prisma from "./prisma";

/**
 * Daily rate limits configuration
 */
export const DAILY_LIMITS = {
  STUDY_MODULES: 3, // Max 3 study modules per day
  AI_CARDS: 30, // Max 30 AI-generated cards per day
} as const;

/**
 * Get the start of today in UTC
 */
function getStartOfTodayUTC(): Date {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  return startOfDay;
}

/**
 * Check if user can create a study module today
 * @param userId - User ID
 * @returns Object with allowed status and current count
 */
export async function checkStudyModuleDailyLimit(userId: string): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
}> {
  const startOfToday = getStartOfTodayUTC();

  // Count study modules created today
  const count = await prisma.studyModule.count({
    where: {
      userId,
      createdAt: {
        gte: startOfToday,
      },
    },
  });

  const limit = DAILY_LIMITS.STUDY_MODULES;
  const allowed = count < limit;
  const remaining = Math.max(0, limit - count);

  return {
    allowed,
    currentCount: count,
    limit,
    remaining,
  };
}

/**
 * Check if user can create AI cards today
 * @param userId - User ID
 * @param requestedCount - Number of cards requested to be created
 * @returns Object with allowed status and current count
 */
export async function checkAICardsDailyLimit(
  userId: string,
  requestedCount: number
): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  requestedCount: number;
}> {
  const startOfToday = getStartOfTodayUTC();

  // Count AI-generated cards created today
  // Count only cards that are marked as AI-generated or belong to an AI-generated module
  const count = await prisma.flashcard.count({
    where: {
      userId,
      createdAt: {
        gte: startOfToday,
      },
      OR: [
        { isAIGenerated: true },
        {
          module: {
            isAIGenerated: true,
          },
        },
      ],
    },
  });

  const limit = DAILY_LIMITS.AI_CARDS;
  const newTotal = count + requestedCount;
  const allowed = newTotal <= limit;
  const remaining = Math.max(0, limit - count);

  return {
    allowed,
    currentCount: count,
    limit,
    remaining,
    requestedCount,
  };
}

/**
 * Get daily usage summary for a user
 */
export async function getDailyUsageSummary(userId: string): Promise<{
  studyModules: {
    current: number;
    limit: number;
    remaining: number;
  };
  aiCards: {
    current: number;
    limit: number;
    remaining: number;
  };
}> {
  const startOfToday = getStartOfTodayUTC();

  const [studyModuleCount, aiCardCount] = await Promise.all([
    prisma.studyModule.count({
      where: {
        userId,
        createdAt: {
          gte: startOfToday,
        },
      },
    }),
    prisma.flashcard.count({
      where: {
        userId,
        createdAt: {
          gte: startOfToday,
        },
        OR: [
          { isAIGenerated: true },
          {
            module: {
              isAIGenerated: true,
            },
          },
        ],
      },
    }),
  ]);

  return {
    studyModules: {
      current: studyModuleCount,
      limit: DAILY_LIMITS.STUDY_MODULES,
      remaining: Math.max(0, DAILY_LIMITS.STUDY_MODULES - studyModuleCount),
    },
    aiCards: {
      current: aiCardCount,
      limit: DAILY_LIMITS.AI_CARDS,
      remaining: Math.max(0, DAILY_LIMITS.AI_CARDS - aiCardCount),
    },
  };
}

