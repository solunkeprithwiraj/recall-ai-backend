/**
 * AI Service Interface
 * Defines the common interface for all AI providers
 */

export interface Flashcard {
  question: string;
  answer: string;
  questionType?: string;
  difficultyLevel?: string;
  options?: string[];
}

export interface GenerateFlashcardsOptions {
  content: string;
  subject?: string;
  educationLevel?: string;
  difficultyLevel?: string;
  numberOfCards?: number;
  questionTypes?: string[];
}

export interface GenerateFlashcardsFromTopicOptions {
  topic: string;
  subject?: string;
  educationLevel?: string;
  difficultyLevel?: string;
  numberOfCards?: number;
  questionTypes?: string[];
}

export interface StudyModulePlan {
  title: string;
  description: string;
  topics: string[];
  learningPlan: {
    week: number;
    topic: string;
    description: string;
    flashcardsCount: number;
  }[];
  estimatedHours: number;
}

export interface StudyModuleWithFlashcards {
  module: StudyModulePlan;
  flashcards: Flashcard[];
}

export interface GenerateStudyModuleOptions {
  topic: string;
  subject?: string;
  educationLevel?: string;
  difficultyLevel?: string;
  numberOfCards?: number;
  estimatedHours?: number;
}

/**
 * Interface that all AI providers must implement
 */
export interface AIService {
  /**
   * Generate flashcards from text content
   */
  generateFlashcards(options: GenerateFlashcardsOptions): Promise<Flashcard[]>;

  /**
   * Generate flashcards from a topic/subject
   */
  generateFlashcardsFromTopic(options: GenerateFlashcardsFromTopicOptions): Promise<Flashcard[]>;

  /**
   * Generate a complete study module with flashcards
   */
  generateStudyModule(options: GenerateStudyModuleOptions): Promise<StudyModuleWithFlashcards>;
}

