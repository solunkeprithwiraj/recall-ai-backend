/**
 * Vertex AI Service
 * Handles all interactions with Google Vertex AI for flashcard generation
 */

import { ChatVertexAI } from "@langchain/google-vertexai";
import {
  getVertexAICredentials,
  getVertexAIProjectId,
  getVertexAILocation,
} from "../utils/vertex-ai-credentials";
import type {
  AIService,
  Flashcard,
  GenerateFlashcardsOptions,
  GenerateFlashcardsFromTopicOptions,
  GenerateStudyModuleOptions,
  StudyModulePlan,
  StudyModuleWithFlashcards,
} from './ai.interface';

let chatModel: ChatVertexAI | null = null;
let serviceInstance: VertexAIService | null = null;

/**
 * Initialize Vertex AI client with service account credentials
 */
function initializeVertexAI(): void {
  try {
    const credentials = getVertexAICredentials();
    const projectId = getVertexAIProjectId();
    const location = getVertexAILocation();

    // Set environment variable for Google Auth library to detect project
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      process.env.GOOGLE_CLOUD_PROJECT = projectId;
    }

    // Format credentials for Google Auth
    const authCredentials = {
      type: credentials.type,
      project_id: credentials.project_id,
      private_key_id: credentials.private_key_id,
      private_key: credentials.private_key.replace(/\\n/g, "\n"),
      client_email: credentials.client_email,
      client_id: credentials.client_id,
      auth_uri: credentials.auth_uri,
      token_uri: credentials.token_uri,
      auth_provider_x509_cert_url: credentials.auth_provider_x509_cert_url,
      client_x509_cert_url: credentials.client_x509_cert_url,
    } as any;

    // Initialize LangChain ChatVertexAI model
    chatModel = new ChatVertexAI({
      model: process.env.GOOGLE_VERTEX_AI_MODEL || "gemini-1.5-pro",
      temperature: parseFloat(process.env.GOOGLE_VERTEX_AI_TEMPERATURE || "0.7"),
      maxOutputTokens: parseInt(
        process.env.GOOGLE_VERTEX_AI_MAX_OUTPUT_TOKENS || "2048",
        10
      ),
      project: projectId,
      location: location,
      authOptions: {
        credentials: authCredentials,
        projectId: projectId,
      },
    } as any);

    console.log(`✅ Vertex AI initialized with project: ${projectId}, location: ${location}`);
  } catch (error) {
    console.error("❌ Failed to initialize Vertex AI:", error);
    throw error;
  }
}

/**
 * Get or initialize the ChatVertexAI model
 */
function getChatModel(): ChatVertexAI {
  if (!chatModel) {
    initializeVertexAI();
  }
  if (!chatModel) {
    throw new Error("Failed to initialize ChatVertexAI model");
  }
  return chatModel;
}

/**
 * Vertex AI Service Class
 */
class VertexAIService implements AIService {
  private initialized: boolean = false;

  constructor() {
    try {
      const credentials = getVertexAICredentials();
      if (!credentials) {
        throw new Error('Vertex AI credentials not configured');
      }
      this.initialized = true;
      console.log('✅ Vertex AI service initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Vertex AI service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build education level based prompt
   */
  private getEducationPrompt(educationLevel: string): string {
    const prompts: Record<string, string> = {
      elementary:
        "You are a child-friendly educational content creator. Create simple, engaging flashcards with basic vocabulary, visual descriptions, and encouraging language suitable for elementary school students (1st-5th grade).",
      middle:
        "You are an educational content creator for middle school students. Create flashcards that use age-appropriate vocabulary, clear explanations, and encourage critical thinking suitable for 6th-8th grade students.",
      high_school:
        "You are an educational content creator for high school students. Create flashcards that use appropriate academic vocabulary, detailed explanations, and prepare students for standardized tests.",
      college:
        "You are an educational content creator for college students. Create flashcards that use advanced academic vocabulary, complex concepts, and test deep understanding suitable for university-level studies.",
      competitive:
        "You are an expert educational content creator for competitive exam preparation. Create flashcards with precise terminology, comprehensive explanations, and analytical questions suitable for exams like UPSC, GRE, etc.",
    };

    return prompts[educationLevel] || prompts.high_school;
  }

  async generateFlashcards(options: GenerateFlashcardsOptions): Promise<Flashcard[]> {
    try {
      const model = getChatModel();
      const {
        content,
        subject = "General",
        educationLevel = "high_school",
        difficultyLevel = "intermediate",
        numberOfCards = 5,
        questionTypes = ["multiple_choice", "true_false", "short_answer"],
      } = options;

      const systemPrompt = this.getEducationPrompt(educationLevel);

      const prompt = `${systemPrompt}

Generate ${numberOfCards} flashcards from the following content. Use a mix of these question types: ${questionTypes.join(", ")}.

Subject: ${subject}
Difficulty Level: ${difficultyLevel}
Education Level: ${educationLevel}

Content:
${content}

Please return the flashcards in JSON format as an array of objects with the following structure:
[
  {
    "question": "The question text",
    "answer": "The answer text or letter (A, B, C, D)",
    "questionType": "multiple_choice|true_false|short_answer|fill_in_blank",
    "difficultyLevel": "${difficultyLevel}",
    "options": ["Option A", "Option B", "Option C", "Option D"]
  }
]

IMPORTANT: For multiple_choice questions, include exactly 4 options in the "options" array, and make sure the "answer" is the correct option text (not just the letter). For other question types, omit the "options" field.

Return ONLY the JSON array, no additional text or markdown formatting.`;

      const response = await (model as any).invoke(prompt);
      const responseText = typeof response.content === "string" ? response.content : String(response.content);

      let jsonText = responseText.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```\n?/g, "");
      }

      const flashcards: Flashcard[] = JSON.parse(jsonText);

      if (!Array.isArray(flashcards)) {
        throw new Error("AI response is not an array");
      }

      return flashcards.map((card) => ({
        question: card.question || "",
        answer: card.answer || "",
        questionType: card.questionType || "short_answer",
        difficultyLevel: card.difficultyLevel || difficultyLevel,
        options: card.options || undefined,
      }));
    } catch (error) {
      console.error("Error generating flashcards with Vertex AI:", error);
      throw new Error(
        `Failed to generate flashcards: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async generateFlashcardsFromTopic(options: GenerateFlashcardsFromTopicOptions): Promise<Flashcard[]> {
    const {
      topic,
      subject = "General",
      educationLevel = "high_school",
      difficultyLevel = "intermediate",
      numberOfCards = 10,
      questionTypes = ["multiple_choice", "true_false", "short_answer"],
    } = options;

    const content = `Create flashcards about the topic: ${topic}`;

    return this.generateFlashcards({
      content,
      subject,
      educationLevel,
      difficultyLevel,
      numberOfCards,
      questionTypes,
    });
  }

  async generateStudyModule(options: GenerateStudyModuleOptions): Promise<StudyModuleWithFlashcards> {
    try {
      const model = getChatModel();
      const {
        topic,
        subject = "General",
        educationLevel = "high_school",
        difficultyLevel = "intermediate",
        numberOfCards = 20,
        estimatedHours,
      } = options;

      const systemPrompt = this.getEducationPrompt(educationLevel);

      const modulePrompt = `${systemPrompt}

Create a comprehensive study module for the topic: "${topic}"

Subject: ${subject}
Difficulty Level: ${difficultyLevel}
Education Level: ${educationLevel}
Target number of flashcards: ${numberOfCards}

Please return the study module structure in JSON format with the following structure:
{
  "title": "A clear, engaging title for the study module",
  "description": "A detailed description of what this module covers (2-3 sentences)",
  "topics": ["Topic 1", "Topic 2", "Topic 3", ...], // Array of 3-7 main topics to cover
  "learningPlan": [
    {
      "week": 1,
      "topic": "Topic name",
      "description": "What will be learned in this week",
      "flashcardsCount": 5 // Number of flashcards for this week/topic
    },
    ...
  ],
  "estimatedHours": ${estimatedHours || Math.ceil(numberOfCards / 5)}
}

Return ONLY the JSON object, no additional text or markdown formatting.`;

      console.log("[Vertex AI] Invoking model for module structure generation...");
      const moduleResponse = await (model as any).invoke(modulePrompt);
      console.log("[Vertex AI] Module structure generation completed");
      let moduleResponseText =
        typeof moduleResponse.content === "string"
          ? moduleResponse.content
          : String(moduleResponse.content);

      let moduleJsonText = moduleResponseText.trim();
      if (moduleJsonText.startsWith("```json")) {
        moduleJsonText = moduleJsonText.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
      } else if (moduleJsonText.startsWith("```")) {
        moduleJsonText = moduleJsonText.replace(/```\n?/g, "");
      }

      const modulePlan: StudyModulePlan = JSON.parse(moduleJsonText);

      if (!modulePlan.title || !modulePlan.topics || !modulePlan.learningPlan) {
        throw new Error("Invalid study module structure from AI");
      }

      const allFlashcards: Flashcard[] = [];
      const totalCardsNeeded = numberOfCards;
      const cardsPerTopic = Math.max(2, Math.floor(totalCardsNeeded / modulePlan.topics.length));

      console.log(`[Vertex AI] Generating flashcards for ${modulePlan.learningPlan.length} topics...`);
      for (let i = 0; i < modulePlan.learningPlan.length; i++) {
        const weekPlan = modulePlan.learningPlan[i];
        const cardsForThisTopic = Math.min(weekPlan.flashcardsCount || cardsPerTopic, totalCardsNeeded - allFlashcards.length);
        
        if (cardsForThisTopic <= 0) break;

        try {
          console.log(`[Vertex AI] Generating ${cardsForThisTopic} flashcards for topic ${i + 1}/${modulePlan.learningPlan.length}: ${weekPlan.topic}`);
          const topicFlashcards = await this.generateFlashcards({
            content: `Topic: ${weekPlan.topic}. ${weekPlan.description}`,
            subject,
            educationLevel,
            difficultyLevel,
            numberOfCards: cardsForThisTopic,
            questionTypes: ["multiple_choice", "true_false", "short_answer"],
          });

          allFlashcards.push(...topicFlashcards);
          console.log(`[Vertex AI] Generated ${topicFlashcards.length} flashcards for topic: ${weekPlan.topic}`);
        } catch (error) {
          console.error(`[Vertex AI] Error generating flashcards for topic ${weekPlan.topic}:`, error);
        }
      }

      if (allFlashcards.length < totalCardsNeeded) {
        const remainingCards = totalCardsNeeded - allFlashcards.length;
        try {
          const additionalFlashcards = await this.generateFlashcards({
            content: `General questions about ${topic}`,
            subject,
            educationLevel,
            difficultyLevel,
            numberOfCards: remainingCards,
            questionTypes: ["multiple_choice", "true_false", "short_answer"],
          });
          allFlashcards.push(...additionalFlashcards);
        } catch (error) {
          console.error("Error generating additional flashcards:", error);
        }
      }

      return {
        module: modulePlan,
        flashcards: allFlashcards.slice(0, totalCardsNeeded),
      };
    } catch (error) {
      console.error("Error generating study module with Vertex AI:", error);
      throw new Error(
        `Failed to generate study module: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

// Export singleton instance
export function getVertexAIService(): VertexAIService {
  if (!serviceInstance) {
    serviceInstance = new VertexAIService();
  }
  return serviceInstance;
}

export default VertexAIService;
