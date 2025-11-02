/**
 * AI Service Factory
 * Provides a unified interface for all AI providers
 */

import { getAIProvider, AIProvider } from "../config/ai.config";
import type { AIService } from "./ai.interface";
import { getVertexAIService } from "./vertex-ai.service";
import { getGoogleGeminiService } from "./google-gemini.service";
import { getOpenAIService } from "./openai.service";
import { getOpenRouterService } from "./openrouter.service";

let aiServiceInstance: AIService | null = null;

/**
 * Get the configured AI service instance
 * This factory pattern allows switching between different AI providers
 * based on the AI_PROVIDER environment variable
 */
export function getAIService(): AIService {
  if (aiServiceInstance) {
    return aiServiceInstance;
  }

  const provider = getAIProvider();

  console.log(`🤖 Initializing AI Service with provider: ${provider}`);

  try {
    switch (provider) {
      case AIProvider.VERTEX_AI:
        aiServiceInstance = getVertexAIService();
        break;

      case AIProvider.GOOGLE_API_KEY:
        aiServiceInstance = getGoogleGeminiService();
        break;

      case AIProvider.OPENAI:
        aiServiceInstance = getOpenAIService();
        break;

      case AIProvider.OPENROUTER:
        aiServiceInstance = getOpenRouterService();
        break;

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }

    console.log(
      `✅ AI Service initialized successfully with provider: ${provider}`
    );
    return aiServiceInstance;
  } catch (error) {
    console.error(
      `❌ Failed to initialize AI service with provider: ${provider}`,
      error
    );
    throw error;
  }
}

/**
 * Reset the AI service instance (useful for testing or configuration changes)
 */
export function resetAIService(): void {
  aiServiceInstance = null;
}

export default getAIService;
