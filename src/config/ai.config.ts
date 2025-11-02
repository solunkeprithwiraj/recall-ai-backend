/**
 * AI Configuration System
 * Manages AI provider selection and environment variable configuration
 */

export enum AIProvider {
  VERTEX_AI = "vertex-ai",
  GOOGLE_API_KEY = "google-api-key",
  OPENAI = "openai",
  OPENROUTER = "openrouter",
}

export interface AIConfig {
  provider: AIProvider;
  isConfigured: boolean;
  credentials: {
    vertexAI?: {
      credentials: string;
      projectId: string;
      location: string;
      model: string;
      temperature: string;
      maxOutputTokens: string;
    };
    googleAPIKey?: {
      apiKey: string;
      model: string;
      temperature: string;
      maxOutputTokens: string;
    };
    openAI?: {
      apiKey: string;
      model: string;
      temperature: string;
      maxTokens: string;
    };
    openRouter?: {
      apiKey: string;
      baseURL: string;
      model: string;
      temperature: string;
      maxTokens: string;
    };
  };
}

/**
 * Get the currently selected AI provider from environment
 */
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();

  const validProviders: AIProvider[] = [
    AIProvider.VERTEX_AI,
    AIProvider.GOOGLE_API_KEY,
    AIProvider.OPENAI,
    AIProvider.OPENROUTER,
  ];

  if (!provider || !validProviders.includes(provider as AIProvider)) {
    console.warn(
      `⚠️  AI_PROVIDER not set or invalid (${provider}). Defaulting to 'openai'.`
    );
    console.warn(`   Valid options: ${validProviders.join(", ")}`);
    return AIProvider.GOOGLE_API_KEY; // Default to Google API Key
  }

  return provider as AIProvider;
}

/**
 * Check if a specific provider is configured
 */
export function isProviderConfigured(provider: AIProvider): boolean {
  switch (provider) {
    case AIProvider.VERTEX_AI:
      return !!(
        process.env.GOOGLE_VERTEX_AI_CREDENTIALS &&
        process.env.GOOGLE_CLOUD_PROJECT
      );

    case AIProvider.GOOGLE_API_KEY:
      return !!process.env.GOOGLE_GEMINI_API_KEY;

    case AIProvider.OPENAI:
      return !!process.env.OPENAI_API_KEY;

    case AIProvider.OPENROUTER:
      return !!(
        process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_BASE_URL
      );

    default:
      return false;
  }
}

/**
 * Get current AI configuration
 */
export function getAIConfig(): AIConfig {
  const provider = getAIProvider();

  return {
    provider,
    isConfigured: isProviderConfigured(provider),
    credentials: {
      vertexAI: {
        credentials: process.env.GOOGLE_VERTEX_AI_CREDENTIALS || "",
        projectId: process.env.GOOGLE_CLOUD_PROJECT || "",
        location: process.env.GOOGLE_VERTEX_AI_LOCATION || "us-central1",
        model: process.env.GOOGLE_VERTEX_AI_MODEL || "gemini-1.5-pro",
        temperature: process.env.GOOGLE_VERTEX_AI_TEMPERATURE || "0.7",
        maxOutputTokens:
          process.env.GOOGLE_VERTEX_AI_MAX_OUTPUT_TOKENS || "2048",
      },
      googleAPIKey: {
        apiKey: process.env.GOOGLE_GEMINI_API_KEY || "",
        model: process.env.GOOGLE_GEMINI_MODEL || "gemini-2.0-flash",
        temperature: process.env.GOOGLE_GEMINI_TEMPERATURE || "0.7",
        maxOutputTokens: process.env.GOOGLE_GEMINI_MAX_OUTPUT_TOKENS || "2048",
      },
      openAI: {
        apiKey: process.env.OPENAI_API_KEY || "",
        model: process.env.OPENAI_MODEL || "gpt-4",
        temperature: process.env.OPENAI_TEMPERATURE || "0.7",
        maxTokens: process.env.OPENAI_MAX_TOKENS || "2048",
      },
      openRouter: {
        apiKey: process.env.OPENROUTER_API_KEY || "",
        baseURL:
          process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        model: process.env.OPENROUTER_MODEL || "anthropic/claude-3-sonnet",
        temperature: process.env.OPENROUTER_TEMPERATURE || "0.7",
        maxTokens: process.env.OPENROUTER_MAX_TOKENS || "2048",
      },
    },
  };
}

/**
 * Validate AI configuration on startup
 */
export function validateAIConfig(): void {
  const config = getAIConfig();

  console.log(`🤖 AI Provider: ${config.provider}`);

  if (!config.isConfigured) {
    console.error(
      `❌ AI Provider '${config.provider}' is not properly configured!`
    );
    console.error(
      `   Please check your .env file and set the required credentials.`
    );

    switch (config.provider) {
      case AIProvider.VERTEX_AI:
        console.error(
          `   Required: GOOGLE_VERTEX_AI_CREDENTIALS, GOOGLE_CLOUD_PROJECT`
        );
        break;
      case AIProvider.GOOGLE_API_KEY:
        console.error(`   Required: GOOGLE_GEMINI_API_KEY`);
        break;
      case AIProvider.OPENAI:
        console.error(`   Required: OPENAI_API_KEY`);
        break;
      case AIProvider.OPENROUTER:
        console.error(`   Required: OPENROUTER_API_KEY, OPENROUTER_BASE_URL`);
        break;
    }

    console.error(`   AI features will not work until properly configured.`);
  } else {
    console.log(`✅ AI Provider '${config.provider}' is configured`);
  }
}

/**
 * Get model configuration for the current provider
 */
export function getModelConfig() {
  const config = getAIConfig();

  switch (config.provider) {
    case AIProvider.VERTEX_AI:
      return {
        model: config.credentials.vertexAI!.model,
        temperature: parseFloat(config.credentials.vertexAI!.temperature),
        maxTokens: parseInt(config.credentials.vertexAI!.maxOutputTokens, 10),
      };
    case AIProvider.GOOGLE_API_KEY:
      return {
        model: config.credentials.googleAPIKey!.model,
        temperature: parseFloat(config.credentials.googleAPIKey!.temperature),
        maxTokens: parseInt(
          config.credentials.googleAPIKey!.maxOutputTokens,
          10
        ),
      };
    case AIProvider.OPENAI:
      return {
        model: config.credentials.openAI!.model,
        temperature: parseFloat(config.credentials.openAI!.temperature),
        maxTokens: parseInt(config.credentials.openAI!.maxTokens, 10),
      };
    case AIProvider.OPENROUTER:
      return {
        model: config.credentials.openRouter!.model,
        temperature: parseFloat(config.credentials.openRouter!.temperature),
        maxTokens: parseInt(config.credentials.openRouter!.maxTokens, 10),
      };
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}
