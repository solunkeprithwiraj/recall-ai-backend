/**
 * OpenAI Service
 * Handles all interactions with OpenAI API for flashcard generation
 */

import { getModelConfig } from '../config/ai.config';
import type {
  AIService,
  Flashcard,
  GenerateFlashcardsOptions,
  GenerateFlashcardsFromTopicOptions,
  GenerateStudyModuleOptions,
  StudyModulePlan,
  StudyModuleWithFlashcards,
} from './ai.interface';

class OpenAIService implements AIService {
  private apiKey: string;
  private initialized: boolean = false;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    this.initialized = true;
    console.log('✅ OpenAI service initialized');
  }

  /**
   * Make a request to OpenAI API
   */
  private async makeRequest(prompt: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('OpenAI service not initialized');
    }

    const config = getModelConfig();
    const apiKey = process.env.OPENAI_API_KEY!;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Extract JSON from response
   */
  private extractJSON(text: string): any {
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    return JSON.parse(jsonText);
  }

  /**
   * Build education level based prompt
   */
  private getEducationPrompt(educationLevel: string): string {
    const prompts: Record<string, string> = {
      elementary:
        'You are a child-friendly educational content creator. Create simple, engaging flashcards with basic vocabulary, visual descriptions, and encouraging language suitable for elementary school students (1st-5th grade).',
      middle:
        'You are an educational content creator for middle school students. Create flashcards that use age-appropriate vocabulary, clear explanations, and encourage critical thinking suitable for 6th-8th grade students.',
      high_school:
        'You are an educational content creator for high school students. Create flashcards that use appropriate academic vocabulary, detailed explanations, and prepare students for standardized tests.',
      college:
        'You are an educational content creator for college students. Create flashcards that use advanced academic vocabulary, complex concepts, and test deep understanding suitable for university-level studies.',
      competitive:
        'You are an expert educational content creator for competitive exam preparation. Create flashcards with precise terminology, comprehensive explanations, and analytical questions suitable for exams like UPSC, GRE, etc.',
    };

    return prompts[educationLevel] || prompts.high_school;
  }

  async generateFlashcards(options: GenerateFlashcardsOptions): Promise<Flashcard[]> {
    const {
      content,
      subject = 'General',
      educationLevel = 'high_school',
      difficultyLevel = 'intermediate',
      numberOfCards = 5,
      questionTypes = ['multiple_choice', 'true_false', 'short_answer'],
    } = options;

    const systemPrompt = this.getEducationPrompt(educationLevel);

    const prompt = `${systemPrompt}

Generate ${numberOfCards} flashcards from the following content. Use a mix of these question types: ${questionTypes.join(', ')}.

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

    try {
      const responseText = await this.makeRequest(prompt);
      const flashcards: Flashcard[] = this.extractJSON(responseText);

      if (!Array.isArray(flashcards)) {
        throw new Error('AI response is not an array');
      }

      return flashcards.map((card) => ({
        question: card.question || '',
        answer: card.answer || '',
        questionType: card.questionType || 'short_answer',
        difficultyLevel: card.difficultyLevel || difficultyLevel,
        options: card.options || undefined,
      }));
    } catch (error) {
      console.error('Error generating flashcards with OpenAI:', error);
      throw new Error(
        `Failed to generate flashcards: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateFlashcardsFromTopic(options: GenerateFlashcardsFromTopicOptions): Promise<Flashcard[]> {
    const { topic, subject = 'General', educationLevel = 'high_school', difficultyLevel = 'intermediate', numberOfCards = 10, questionTypes = ['multiple_choice', 'true_false', 'short_answer'] } = options;

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
    const {
      topic,
      subject = 'General',
      educationLevel = 'high_school',
      difficultyLevel = 'intermediate',
      numberOfCards = 20,
      estimatedHours,
    } = options;

    const systemPrompt = this.getEducationPrompt(educationLevel);

    // First, generate the study module structure
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

    try {
      const moduleResponseText = await this.makeRequest(modulePrompt);
      const modulePlan: StudyModulePlan = this.extractJSON(moduleResponseText);

      if (!modulePlan.title || !modulePlan.topics || !modulePlan.learningPlan) {
        throw new Error('Invalid study module structure from AI');
      }

      // Generate flashcards for each topic
      const allFlashcards: Flashcard[] = [];
      const totalCardsNeeded = numberOfCards;
      const cardsPerTopic = Math.max(2, Math.floor(totalCardsNeeded / modulePlan.topics.length));

      for (let i = 0; i < modulePlan.learningPlan.length; i++) {
        const weekPlan = modulePlan.learningPlan[i];
        const cardsForThisTopic = Math.min(
          weekPlan.flashcardsCount || cardsPerTopic,
          totalCardsNeeded - allFlashcards.length
        );

        if (cardsForThisTopic <= 0) break;

        try {
          const topicFlashcards = await this.generateFlashcards({
            content: `Topic: ${weekPlan.topic}. ${weekPlan.description}`,
            subject,
            educationLevel,
            difficultyLevel,
            numberOfCards: cardsForThisTopic,
            questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
          });

          allFlashcards.push(...topicFlashcards);
        } catch (error) {
          console.error(`Error generating flashcards for topic ${weekPlan.topic}:`, error);
        }
      }

      // If we don't have enough flashcards, generate more general ones
      if (allFlashcards.length < totalCardsNeeded) {
        const remainingCards = totalCardsNeeded - allFlashcards.length;
        try {
          const additionalFlashcards = await this.generateFlashcards({
            content: `General questions about ${topic}`,
            subject,
            educationLevel,
            difficultyLevel,
            numberOfCards: remainingCards,
            questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
          });
          allFlashcards.push(...additionalFlashcards);
        } catch (error) {
          console.error('Error generating additional flashcards:', error);
        }
      }

      return {
        module: modulePlan,
        flashcards: allFlashcards.slice(0, totalCardsNeeded),
      };
    } catch (error) {
      console.error('Error generating study module with OpenAI:', error);
      throw new Error(
        `Failed to generate study module: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export singleton instance
let serviceInstance: OpenAIService | null = null;

export function getOpenAIService(): OpenAIService {
  if (!serviceInstance) {
    serviceInstance = new OpenAIService();
  }
  return serviceInstance;
}

export default OpenAIService;

