/**
 * LLM Analysis Service
 * Handles AI-powered analysis of workshop participant data
 * Supports multiple LLM providers with configurable models
 */

import OpenAI from 'openai';
import { AnonymizedContribution, anonymizationService } from './anonymizationService';

export type LLMProvider = 'openai' | 'anthropic' | 'google';
export type LLMModel =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'gemini-pro';

export interface AnalysisRequest {
  workshopId: string;
  workshopTitle: string;
  workshopDescription?: string;
  anonymizedData: AnonymizedContribution[];
  promptTemplate: string;
  modelName: LLMModel;
  customInstructions?: string;
}

export interface AnalysisResult {
  summary: string;
  insights: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  themes: Array<{
    theme: string;
    frequency: number;
    examples: string[];
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    actionable: boolean;
  }>;
  suggestedPlan?: {
    introduction: string;
    activities: Array<{
      title: string;
      duration: string;
      description: string;
    }>;
    conclusion: string;
  };
}

export interface LLMAnalysisMetadata {
  model: string;
  provider: LLMProvider;
  tokensUsed: number;
  processingTimeMs: number;
  participantCount: number;
  confidenceScore?: number;
}

export class LLMAnalysisService {
  private openaiClient: OpenAI | null = null;

  constructor() {
    // Initialize OpenAI client if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Run analysis on anonymized workshop data
   */
  async analyzeWorkshopData(
    request: AnalysisRequest,
  ): Promise<{ result: AnalysisResult; metadata: LLMAnalysisMetadata }> {
    const startTime = Date.now();

    // Determine provider from model
    const provider = this.getProvider(request.modelName);

    // Run analysis based on provider
    let result: AnalysisResult;
    let tokensUsed = 0;

    switch (provider) {
      case 'openai':
        const openaiResult = await this.analyzeWithOpenAI(request);
        result = openaiResult.result;
        tokensUsed = openaiResult.tokensUsed;
        break;

      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented');

      case 'google':
        throw new Error('Google provider not yet implemented');

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    const processingTimeMs = Date.now() - startTime;

    const metadata: LLMAnalysisMetadata = {
      model: request.modelName,
      provider,
      tokensUsed,
      processingTimeMs,
      participantCount: request.anonymizedData.length,
    };

    return { result, metadata };
  }

  /**
   * Analyze with OpenAI models
   */
  private async analyzeWithOpenAI(
    request: AnalysisRequest,
  ): Promise<{ result: AnalysisResult; tokensUsed: number }> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized. Check OPENAI_API_KEY.');
    }

    // Format anonymized data
    const formattedData = anonymizationService.formatForLLM(
      request.anonymizedData,
    );

    // Build prompt
    const prompt = this.buildPrompt(request, formattedData);

    // Call OpenAI API
    const completion = await this.openaiClient.chat.completions.create({
      model: this.mapModelName(request.modelName),
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const tokensUsed = completion.usage?.total_tokens || 0;

    // Parse JSON response
    const result = JSON.parse(responseText) as AnalysisResult;

    return { result, tokensUsed };
  }

  /**
   * Build analysis prompt
   */
  private buildPrompt(request: AnalysisRequest, formattedData: string): string {
    let prompt = request.promptTemplate;

    // Replace template variables
    prompt = prompt.replace('{workshop_title}', request.workshopTitle);
    prompt = prompt.replace(
      '{workshop_description}',
      request.workshopDescription || 'N/A',
    );
    prompt = prompt.replace('{participant_data}', formattedData);
    prompt = prompt.replace(
      '{participant_count}',
      request.anonymizedData.length.toString(),
    );

    // Add custom instructions if provided
    if (request.customInstructions) {
      prompt += `\n\nAdditional Instructions:\n${request.customInstructions}`;
    }

    return prompt;
  }

  /**
   * Get system prompt for analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert workshop facilitator and analyst. Your task is to analyze participant responses and generate actionable insights.

You must respond with a valid JSON object following this exact structure:

{
  "summary": "A comprehensive 2-3 paragraph summary of the overall findings",
  "insights": [
    {
      "title": "Insight title",
      "description": "Detailed description of the insight",
      "priority": "high" | "medium" | "low"
    }
  ],
  "themes": [
    {
      "theme": "Theme name",
      "frequency": number (how many participants mentioned this),
      "examples": ["quote 1", "quote 2"]
    }
  ],
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed description",
      "actionable": true | false
    }
  ],
  "suggestedPlan": {
    "introduction": "Opening activity description",
    "activities": [
      {
        "title": "Activity name",
        "duration": "30 minutes",
        "description": "What to do"
      }
    ],
    "conclusion": "Closing activity description"
  }
}

Be specific, actionable, and focus on what will make the workshop most valuable for participants.`;
  }

  /**
   * Get provider from model name
   */
  private getProvider(modelName: LLMModel): LLMProvider {
    if (modelName.startsWith('gpt')) return 'openai';
    if (modelName.startsWith('claude')) return 'anthropic';
    if (modelName.startsWith('gemini')) return 'google';
    return 'openai'; // Default
  }

  /**
   * Map our model names to provider-specific names
   */
  private mapModelName(modelName: LLMModel): string {
    const mapping: Record<LLMModel, string> = {
      'gpt-4': 'gpt-4',
      'gpt-4-turbo': 'gpt-4-turbo-preview',
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini',
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'gemini-pro': 'gemini-pro',
    };

    return mapping[modelName] || modelName;
  }

  /**
   * Get available models
   */
  getAvailableModels(): Array<{ value: LLMModel; label: string; provider: LLMProvider }> {
    return [
      { value: 'gpt-4', label: 'GPT-4 (Most Capable)', provider: 'openai' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Faster)', provider: 'openai' },
      { value: 'gpt-4o', label: 'GPT-4o (Optimized)', provider: 'openai' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Cost-Effective)', provider: 'openai' },
      { value: 'claude-3-opus', label: 'Claude 3 Opus (Coming Soon)', provider: 'anthropic' },
      { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet (Coming Soon)', provider: 'anthropic' },
      { value: 'gemini-pro', label: 'Gemini Pro (Coming Soon)', provider: 'google' },
    ];
  }

  /**
   * Validate analysis result
   */
  validateResult(result: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!result.summary || typeof result.summary !== 'string') {
      errors.push('Missing or invalid summary');
    }

    if (!Array.isArray(result.insights)) {
      errors.push('Missing or invalid insights array');
    }

    if (!Array.isArray(result.themes)) {
      errors.push('Missing or invalid themes array');
    }

    if (!Array.isArray(result.recommendations)) {
      errors.push('Missing or invalid recommendations array');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export const llmAnalysisService = new LLMAnalysisService();
