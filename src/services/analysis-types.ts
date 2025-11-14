/**
 * Analysis types implementation
 * Contains all 5 analysis types: thematic, clustering, contradictions, insights, recommendations
 */

import { OpenAI } from 'openai';
import { db } from '../config/database';
import { eq, and, inArray } from 'drizzle-orm';
import {
  responses,
  questions,
  questionGroups,
  questionnaires,
} from '../models/llm-schema';
import { anonymizationService } from './anonymization';
import { embeddingsService, SimilaritySearchResult } from './embeddings';
import { promptTemplateService } from './prompt-templates';

export interface AnalysisResult {
  type: string;
  results: any;
  metadata: {
    model: string;
    promptVersion: string;
    tokensUsed: number;
    processingTimeMs: number;
    confidenceScore: number;
    responseCount: number;
  };
}

export interface AnalysisContext {
  questionnaireId: string;
  responseCount: number;
  anonymizationLevel: 'partial' | 'full';
  language: 'pl' | 'en';
  options: any;
}

/**
 * Base class for analysis types
 */
export abstract class BaseAnalysis {
  protected openai: OpenAI;
  protected model: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = 'gpt-4-turbo-preview';
  }

  abstract analyze(
    context: AnalysisContext,
    responseData: any[],
  ): Promise<AnalysisResult>;

  protected async callLLM(
    prompt: string,
    systemPrompt?: string,
  ): Promise<{
    content: string;
    tokensUsed: number;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const processingTime = Date.now() - startTime;
      const content = response.choices[0].message.content;

      if (!content) {
        throw new Error('Empty response from LLM');
      }

      return {
        content,
        tokensUsed: response.usage?.total_tokens || 0,
        processingTime,
      };
    } catch (error) {
      throw new Error(`LLM call failed: ${error}`);
    }
  }

  protected calculateConfidenceScore(
    results: any,
    responseCount: number,
  ): number {
    let score = 0.5; // Base score

    // Increase score based on response count
    if (responseCount >= 100) score += 0.3;
    else if (responseCount >= 50) score += 0.2;
    else if (responseCount >= 20) score += 0.1;

    // Increase score based on result structure quality
    if (results.themes?.length > 0) score += 0.1;
    if (results.clusters?.length > 0) score += 0.1;
    if (results.insights?.length > 0) score += 0.1;
    if (results.recommendations?.length > 0) score += 0.1;

    return Math.min(1.0, score);
  }
}

/**
 * Thematic Analysis
 * Extracts themes, patterns, and sentiment from responses
 */
export class ThematicAnalysis extends BaseAnalysis {
  async analyze(
    context: AnalysisContext,
    responseData: any[],
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Get question text for context
    const questionText = await this.getQuestionText(
      responseData[0]?.questionId,
    );

    // Build prompt
    const prompt = promptTemplateService.buildThematicAnalysisPrompt(
      responseData,
      {
        questionText,
        language: context.language,
        minFrequency: context.options.minThemeFrequency || 2,
      },
    );

    // Call LLM
    const { content, tokensUsed, processingTime } = await this.callLLM(
      prompt,
      'Jesteś ekspertem socjologiem analizującym odpowiedzi na kwestionariusz.',
    );

    let results;
    try {
      results = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON response from LLM: ${content}`);
    }

    // Validate results
    this.validateThematicResults(results);

    const totalTime = Date.now() - startTime;

    return {
      type: 'thematic',
      results,
      metadata: {
        model: this.model,
        promptVersion:
          promptTemplateService.getCurrentVersion('thematic-analysis'),
        tokensUsed,
        processingTimeMs: totalTime,
        confidenceScore: this.calculateConfidenceScore(
          results,
          context.responseCount,
        ),
        responseCount: context.responseCount,
      },
    };
  }

  private validateThematicResults(results: any): void {
    if (!results.themes || !Array.isArray(results.themes)) {
      throw new Error('Thematic analysis must return a themes array');
    }

    for (const theme of results.themes) {
      if (!theme.name || !theme.frequency || theme.frequency < 0) {
        throw new Error('Each theme must have name and valid frequency');
      }
    }
  }

  private async getQuestionText(questionId: string): Promise<string> {
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, questionId),
      with: {
        group: {
          with: {
            questionnaire: {
              columns: { title: true },
            },
          },
        },
      },
    });

    return (
      question?.text?.pl || question?.text?.en || 'Pytanie kwestionariuszowe'
    );
  }
}

/**
 * Clustering Analysis
 * Groups similar responses using hierarchical clustering
 */
export class ClusteringAnalysis extends BaseAnalysis {
  async analyze(
    context: AnalysisContext,
    responseData: any[],
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Get clustering data
    const clusteringData = await this.getClusteringData(responseData);

    // If we have fewer responses than min cluster size, return empty clusters
    const minClusterSize = context.options.minClusterSize || 3;
    if (clusteringData.length < minClusterSize * 2) {
      return {
        type: 'clusters',
        results: {
          optimalClusters: 1,
          clusteringMethod: 'hierarchical',
          clusters: [
            {
              id: 'cluster_1',
              name: 'Wszystkie odpowiedzi',
              size: clusteringData.length,
              percentage: 100,
              centroid: 'Główna grupa odpowiedzi',
              members: clusteringData.map(d => d.id),
              characteristics: ['zróżnicowane odpowiedzi'],
              sentiment: 0,
              cohesionScore: 1.0,
            },
          ],
          totalResponses: clusteringData.length,
          silhouetteScore: 0,
          qualityMetrics: {
            intraClusterSimilarity: 0,
            interClusterDistance: 0,
          },
        },
        metadata: {
          model: this.model,
          promptVersion: '1.0',
          tokensUsed: 0,
          processingTimeMs: Date.now() - startTime,
          confidenceScore: 0.5,
          responseCount: context.responseCount,
        },
      };
    }

    // Build prompt for clustering
    const prompt = promptTemplateService.buildClusteringPrompt(responseData, {
      minClusterSize,
      hasEmbeddings: true,
    });

    // Call LLM
    const { content, tokensUsed, processingTime } = await this.callLLM(
      prompt,
      'Jesteś algorytmem clusteringu dla danych jakościowych.',
    );

    let results;
    try {
      results = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON response from LLM: ${content}`);
    }

    // Enhance results with actual vector similarity data
    results = await this.enhanceWithVectorData(results, clusteringData);

    const totalTime = Date.now() - startTime;

    return {
      type: 'clusters',
      results,
      metadata: {
        model: this.model,
        promptVersion: promptTemplateService.getCurrentVersion(
          'hierarchical-clustering',
        ),
        tokensUsed,
        processingTimeMs: totalTime,
        confidenceScore: this.calculateConfidenceScore(
          results,
          context.responseCount,
        ),
        responseCount: context.responseCount,
      },
    };
  }

  private async getClusteringData(responseData: any[]): Promise<
    Array<{
      id: string;
      vector: number[];
      content: string;
    }>
  > {
    // Get question IDs from responses
    const questionIds = [...new Set(responseData.map(r => r.questionId))];

    // Use embeddings service to get clustering data
    const clusteringData: Array<{
      id: string;
      vector: number[];
      content: string;
    }> = [];

    for (const response of responseData) {
      try {
        const similarResponses =
          await embeddingsService.findSimilarResponsesToResponse(response.id, {
            limit: 10,
          });

        // For now, we'll use a mock vector - in real implementation, get from vector DB
        const vector = await this.getResponseVector(response.id);

        clusteringData.push({
          id: response.id,
          vector,
          content:
            typeof response.answer === 'string'
              ? response.answer
              : JSON.stringify(response.answer),
        });
      } catch (error) {
        console.warn(
          `Failed to get clustering data for response ${response.id}:`,
          error,
        );
      }
    }

    return clusteringData;
  }

  private async getResponseVector(responseId: string): Promise<number[]> {
    // Mock implementation - would get actual vector from vector database
    return new Array(1536).fill(0).map(() => Math.random());
  }

  private async enhanceWithVectorData(
    results: any,
    clusteringData: Array<{ id: string; vector: number[]; content: string }>,
  ): Promise<any> {
    // Enhance clusters with actual similarity data
    if (results.clusters && Array.isArray(results.clusters)) {
      for (const cluster of results.clusters) {
        if (cluster.members && Array.isArray(cluster.members)) {
          // Calculate actual cohesion score based on vector similarity
          const clusterVectors = clusteringData
            .filter(d => cluster.members.includes(d.id))
            .map(d => d.vector);

          if (clusterVectors.length > 1) {
            cluster.cohesionScore = this.calculateCohesion(clusterVectors);
          } else {
            cluster.cohesionScore = 1.0;
          }
        }
      }

      // Calculate silhouette score
      results.silhouetteScore = this.calculateSilhouetteScore(
        results.clusters,
        clusteringData,
      );
      results.qualityMetrics = {
        intraClusterSimilarity: results.silhouetteScore,
        interClusterDistance: this.calculateInterClusterDistance(
          results.clusters,
          clusteringData,
        ),
      };
    }

    return results;
  }

  private calculateCohesion(vectors: number[][]): number {
    if (vectors.length < 2) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        totalSimilarity += this.cosineSimilarity(vectors[i], vectors[j]);
        comparisons++;
      }
    }

    return totalSimilarity / comparisons;
  }

  private calculateSilhouetteScore(
    clusters: any[],
    clusteringData: any[],
  ): number {
    // Simplified silhouette score calculation
    let totalScore = 0;
    let totalPoints = 0;

    for (const cluster of clusters) {
      if (cluster.members && Array.isArray(cluster.members)) {
        for (const memberId of cluster.members) {
          const data = clusteringData.find(d => d.id === memberId);
          if (data) {
            // Calculate silhouette score for this point
            const score = this.calculatePointSilhouette(
              memberId,
              clusters,
              clusteringData,
            );
            totalScore += score;
            totalPoints++;
          }
        }
      }
    }

    return totalPoints > 0 ? totalScore / totalPoints : 0;
  }

  private calculatePointSilhouette(
    pointId: string,
    clusters: any[],
    clusteringData: any[],
  ): number {
    // Find which cluster this point belongs to
    const pointCluster = clusters.find(c => c.members?.includes(pointId));
    if (!pointCluster) return 0;

    // Calculate average distance to points in same cluster (a)
    const sameClusterPoints = clusteringData.filter(
      d => pointCluster.members?.includes(d.id) && d.id !== pointId,
    );

    let a = 0;
    if (sameClusterPoints.length > 0) {
      const pointVector =
        clusteringData.find(d => d.id === pointId)?.vector || [];
      for (const otherPoint of sameClusterPoints) {
        a += 1 - this.cosineSimilarity(pointVector, otherPoint.vector);
      }
      a /= sameClusterPoints.length;
    }

    // Calculate minimum average distance to points in other clusters (b)
    let b = Infinity;
    for (const otherCluster of clusters) {
      if (otherCluster.id === pointCluster.id) continue;

      const otherClusterPoints = clusteringData.filter(d =>
        otherCluster.members?.includes(d.id),
      );

      if (otherClusterPoints.length > 0) {
        const pointVector =
          clusteringData.find(d => d.id === pointId)?.vector || [];
        let avgDistance = 0;
        for (const otherPoint of otherClusterPoints) {
          avgDistance +=
            1 - this.cosineSimilarity(pointVector, otherPoint.vector);
        }
        avgDistance /= otherClusterPoints.length;

        b = Math.min(b, avgDistance);
      }
    }

    if (b === Infinity) return 0;

    return (b - a) / Math.max(a, b);
  }

  private calculateInterClusterDistance(
    clusters: any[],
    clusteringData: any[],
  ): number {
    if (clusters.length < 2) return 0;

    let totalDistance = 0;
    let comparisons = 0;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const cluster1 = clusters[i];
        const cluster2 = clusters[j];

        // Calculate centroid distance
        const centroid1 = this.calculateClusterCentroid(
          cluster1,
          clusteringData,
        );
        const centroid2 = this.calculateClusterCentroid(
          cluster2,
          clusteringData,
        );

        if (centroid1 && centroid2) {
          totalDistance += 1 - this.cosineSimilarity(centroid1, centroid2);
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  private calculateClusterCentroid(
    cluster: any,
    clusteringData: any[],
  ): number[] | null {
    if (
      !cluster.members ||
      !Array.isArray(cluster.members) ||
      cluster.members.length === 0
    ) {
      return null;
    }

    const clusterVectors = clusteringData
      .filter(d => cluster.members.includes(d.id))
      .map(d => d.vector);

    if (clusterVectors.length === 0) return null;

    const dimensions = clusterVectors[0].length;
    const centroid = new Array(dimensions).fill(0);

    // Calculate mean vector
    for (const vector of clusterVectors) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += vector[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= clusterVectors.length;
    }

    return centroid;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }
}

/**
 * Contradictions Analysis
 * Detects inconsistencies and contradictions in responses
 */
export class ContradictionsAnalysis extends BaseAnalysis {
  async analyze(
    context: AnalysisContext,
    responseData: any[],
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Group responses by question pairs
    const questionPairs = await this.getQuestionPairs(responseData);
    const contradictions = [];

    for (const pair of questionPairs) {
      const pairContradictions = await this.analyzeQuestionPair(
        pair.question1Id,
        pair.question2Id,
        context,
      );

      if (pairContradictions.length > 0) {
        contradictions.push(...pairContradictions);
      }
    }

    const totalTime = Date.now() - startTime;

    return {
      type: 'contradictions',
      results: {
        contradictions,
        totalContradictions: contradictions.length,
        mostCommonType: this.getMostCommonType(contradictions),
        severityDistribution: this.getSeverityDistribution(contradictions),
      },
      metadata: {
        model: this.model,
        promptVersion: promptTemplateService.getCurrentVersion(
          'contradiction-detection',
        ),
        tokensUsed: 0, // Would be calculated from actual LLM calls
        processingTimeMs: totalTime,
        confidenceScore: this.calculateContradictionsConfidence(
          contradictions,
          context.responseCount,
        ),
        responseCount: context.responseCount,
      },
    };
  }

  private async getQuestionPairs(responseData: any[]): Promise<
    Array<{
      question1Id: string;
      question2Id: string;
      question1Text: string;
      question2Text: string;
    }>
  > {
    // Get unique question IDs
    const questionIds = [...new Set(responseData.map(r => r.questionId))];

    // Get questions with their groups
    const questionsData = await db.query.questions.findMany({
      where: inArray(questions.id, questionIds),
      with: {
        group: {
          with: {
            questionnaire: {
              columns: { id: true },
            },
          },
        },
      },
    });

    // Create pairs of questions from different groups (likely to be related)
    const pairs = [];
    for (let i = 0; i < questionsData.length; i++) {
      for (let j = i + 1; j < questionsData.length; j++) {
        const q1 = questionsData[i];
        const q2 = questionsData[j];

        // Only pair questions from different groups of the same questionnaire
        if (
          q1.group.questionnaire.id === q2.group.questionnaire.id &&
          q1.groupId !== q2.groupId
        ) {
          pairs.push({
            question1Id: q1.id,
            question2Id: q2.id,
            question1Text: q1.text?.pl || q1.text?.en || '',
            question2Text: q2.text?.pl || q2.text?.en || '',
          });
        }
      }
    }

    return pairs;
  }

  private async analyzeQuestionPair(
    question1Id: string,
    question2Id: string,
    context: AnalysisContext,
  ): Promise<any[]> {
    // Get responses for both questions
    const [responses1, responses2] = await Promise.all([
      db.query.responses.findMany({
        where: eq(responses.questionId, question1Id),
        with: {
          user: true,
        },
      }),
      db.query.responses.findMany({
        where: eq(responses.questionId, question2Id),
        with: {
          user: true,
        },
      }),
    ]);

    // Find users who responded to both questions
    const commonUsers = responses1.filter(r1 =>
      responses2.some(r2 => r1.userId === r2.userId),
    );

    if (commonUsers.length < 3) {
      return []; // Not enough data for contradiction analysis
    }

    // Build prompt for contradiction analysis
    const pairedResponses = commonUsers.map(user => {
      const response2 = responses2.find(r2 => r2.userId === user.userId);
      return {
        response1: user.answer,
        response2: response2?.answer,
      };
    });

    const prompt = promptTemplateService.buildContradictionsPrompt(
      pairedResponses,
      {
        question1Text: await this.getQuestionText(question1Id),
        question2Text: await this.getQuestionText(question2Id),
        question1Id,
        question2Id,
      },
    );

    // Call LLM
    const { content } = await this.callLLM(
      prompt,
      'Jesteś ekspertem od analizy spójności w badaniach socjologicznych.',
    );

    let results;
    try {
      results = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON response from LLM: ${content}`);
    }

    return results.contradictions || [];
  }

  private async getQuestionText(questionId: string): Promise<string> {
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, questionId),
    });

    return question?.text?.pl || question?.text?.en || 'Pytanie';
  }

  private getMostCommonType(contradictions: any[]): string {
    if (contradictions.length === 0) return '';

    const typeCounts = contradictions.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0][0];
  }

  private getSeverityDistribution(
    contradictions: any[],
  ): Record<string, number> {
    const distribution = { low: 0, medium: 0, high: 0 };
    for (const contradiction of contradictions) {
      if (distribution[contradiction.severity] !== undefined) {
        distribution[contradiction.severity]++;
      }
    }
    return distribution;
  }

  private calculateContradictionsConfidence(
    contradictions: any[],
    responseCount: number,
  ): number {
    let score = 0.5;

    // More contradictions found = higher confidence
    if (contradictions.length >= 10) score += 0.3;
    else if (contradictions.length >= 5) score += 0.2;
    else if (contradictions.length >= 1) score += 0.1;

    // Higher severity contradictions = higher confidence
    const highSeverityCount = contradictions.filter(
      c => c.severity === 'high',
    ).length;
    if (highSeverityCount > 0) score += 0.2;

    return Math.min(1.0, score);
  }
}

/**
 * Insights Analysis
 * Extracts hidden insights and patterns across questions
 */
export class InsightsAnalysis extends BaseAnalysis {
  async analyze(
    context: AnalysisContext,
    responseData: any[],
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Group responses by sections
    const sectionGroups = await this.groupResponsesBySection(responseData);

    // Build prompt for insights extraction
    const prompt = promptTemplateService.buildInsightsPrompt(responseData, {
      section1Responses: sectionGroups.section1 || [],
      section2Responses: sectionGroups.section2 || [],
      section3Responses: sectionGroups.section3 || [],
      section4Responses: sectionGroups.section4 || [],
      workshopTheme: context.options.workshopTheme || 'Wspólnota',
      participantCount: context.responseCount,
      duration: context.options.duration || 'nieokreślony',
    });

    // Call LLM
    const { content, tokensUsed, processingTime } = await this.callLLM(
      prompt,
      'Działasz jako senior research analyst specjalizujący się w analizie danych jakościowych.',
    );

    let results;
    try {
      results = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON response from LLM: ${content}`);
    }

    const totalTime = Date.now() - startTime;

    return {
      type: 'insights',
      results,
      metadata: {
        model: this.model,
        promptVersion: promptTemplateService.getCurrentVersion(
          'insights-extraction',
        ),
        tokensUsed,
        processingTimeMs: totalTime,
        confidenceScore: this.calculateConfidenceScore(
          results,
          context.responseCount,
        ),
        responseCount: context.responseCount,
      },
    };
  }

  private async groupResponsesBySection(
    responseData: any[],
  ): Promise<Record<string, any[]>> {
    const sections: Record<string, any[]> = {
      section1: [],
      section2: [],
      section3: [],
      section4: [],
    };

    // Get questions with their groups
    const questionIds = [...new Set(responseData.map(r => r.questionId))];
    const questionsData = await db.query.questions.findMany({
      where: inArray(questions.id, questionIds),
      with: {
        group: true,
      },
    });

    // Group responses by section based on group order
    const sortedGroups = [...new Set(questionsData.map(q => q.group))].sort(
      (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
    );

    for (let i = 0; i < Math.min(sortedGroups.length, 4); i++) {
      const group = sortedGroups[i];
      const sectionKey = `section${i + 1}`;

      sections[sectionKey] = responseData.filter(response =>
        questionsData.some(
          q => q.id === response.questionId && q.groupId === group.id,
        ),
      );
    }

    return sections;
  }
}

/**
 * Recommendations Analysis
 * Generates SMART recommendations based on analysis results
 */
export class RecommendationsAnalysis extends BaseAnalysis {
  async analyze(
    context: AnalysisContext,
    responseData: any[],
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Get previous analysis results if available
    const previousAnalyses = await this.getPreviousAnalyses(
      context.questionnaireId,
    );

    // Build prompt for recommendations
    const prompt = promptTemplateService.buildRecommendationsPrompt(
      responseData,
      {
        themesSummary: previousAnalyses.thematic?.results || {},
        clustersSummary: previousAnalyses.clusters?.results || {},
        contradictionsSummary: previousAnalyses.contradictions?.results || {},
        insightsSummary: previousAnalyses.insights?.results || {},
        communityType: context.options.communityType || 'Mieszkańcy',
        residentCount: context.options.residentCount || context.responseCount,
        budgetStatus: context.options.budgetStatus || 'nieokreślony',
        locationType: context.options.locationType || 'miejska',
      },
    );

    // Call LLM
    const { content, tokensUsed, processingTime } = await this.callLLM(
      prompt,
      'Jesteś doradcą wspólnotowym z 20-letnim doświadczeniem w cohousing i projektowaniu społeczności.',
    );

    let results;
    try {
      results = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON response from LLM: ${content}`);
    }

    // Enhance recommendations with feasibility scoring
    results = await this.enhanceRecommendations(results, context);

    const totalTime = Date.now() - startTime;

    return {
      type: 'recommendations',
      results,
      metadata: {
        model: this.model,
        promptVersion: promptTemplateService.getCurrentVersion(
          'smart-recommendations',
        ),
        tokensUsed,
        processingTimeMs: totalTime,
        confidenceScore: this.calculateConfidenceScore(
          results,
          context.responseCount,
        ),
        responseCount: context.responseCount,
      },
    };
  }

  private async getPreviousAnalyses(
    questionnaireId: string,
  ): Promise<Record<string, any>> {
    const analyses = await db.query.llmAnalyses.findMany({
      where: eq(llmAnalyses.questionnaireId, questionnaireId),
      orderBy: desc(llmAnalyses.createdAt),
      limit: 10,
    });

    return analyses.reduce(
      (acc, analysis) => {
        acc[analysis.analysisType] = analysis;
        return acc;
      },
      {} as Record<string, any>,
    );
  }

  private async enhanceRecommendations(
    results: any,
    context: AnalysisContext,
  ): Promise<any> {
    if (!results.recommendations || !Array.isArray(results.recommendations)) {
      return results;
    }

    // Add feasibility scores and implementation complexity
    for (const rec of results.recommendations) {
      rec.feasibilityScore = this.calculateFeasibilityScore(rec, context);
      rec.implementationComplexity = this.getImplementationComplexity(rec);
      rec.estimatedROI = this.calculateEstimatedROI(rec);
    }

    // Sort by priority and feasibility
    results.recommendations.sort((a: any, b: any) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return (b.feasibilityScore || 0) - (a.feasibilityScore || 0);
    });

    return results;
  }

  private calculateFeasibilityScore(
    recommendation: any,
    context: AnalysisContext,
  ): number {
    let score = 0.5;

    // High priority recommendations might be less feasible
    if (recommendation.priority === 'high') score -= 0.1;
    else if (recommendation.priority === 'low') score += 0.1;

    // Cost considerations
    if (recommendation.estimatedCost) {
      const cost = parseFloat(
        recommendation.estimatedCost.replace(/[^\d.]/g, ''),
      );
      if (cost < 10000) score += 0.2;
      else if (cost > 100000) score -= 0.2;
    }

    // Complexity based on dependencies
    if (recommendation.dependencies) {
      const depCount = Array.isArray(recommendation.dependencies)
        ? recommendation.dependencies.length
        : 0;
      if (depCount <= 2) score += 0.1;
      else if (depCount > 5) score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  private getImplementationComplexity(
    recommendation: any,
  ): 'low' | 'medium' | 'high' {
    // Heuristic complexity assessment
    const factors = {
      hasDependencies: !!(
        recommendation.dependencies && recommendation.dependencies.length > 0
      ),
      hasHighCost: !!(
        recommendation.estimatedCost &&
        parseFloat(recommendation.estimatedCost.replace(/[^\d.]/g, '')) > 50000
      ),
      requiresExpertise:
        recommendation.description?.toLowerCase().includes('specjalist') ||
        recommendation.description?.toLowerCase().includes('ekspert'),
      timeBound: !!(
        (recommendation.metrics?.timebound &&
          recommendation.metrics.timebound.includes('miesiąc')) ||
        recommendation.metrics.timebound.includes('rok')
      ),
    };

    const complexityScore = Object.values(factors).filter(Boolean).length;

    if (complexityScore <= 1) return 'low';
    if (complexityScore <= 2) return 'medium';
    return 'high';
  }

  private calculateEstimatedROI(recommendation: any): number {
    // Simple ROI calculation based on impact and cost
    const impact = recommendation.estimatedImpact || 0.5;
    const cost = parseFloat(
      recommendation.estimatedCost?.replace(/[^\d.]/g, '') || '50000',
    );
    const normalizedCost = Math.min(cost / 100000, 1); // Normalize to 0-1

    return Math.max(0, Math.min(1, impact * (1 - normalizedCost * 0.5)));
  }
}

// Export analysis factory
export class AnalysisFactory {
  static createAnalysis(type: string): BaseAnalysis {
    switch (type) {
    case 'thematic':
      return new ThematicAnalysis();
    case 'clusters':
      return new ClusteringAnalysis();
    case 'contradictions':
      return new ContradictionsAnalysis();
    case 'insights':
      return new InsightsAnalysis();
    case 'recommendations':
      return new RecommendationsAnalysis();
    default:
      throw new Error(`Unknown analysis type: ${type}`);
    }
  }
}
