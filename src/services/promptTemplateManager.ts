/**
 * Advanced Prompt Template Manager for LLM Analysis
 * Provides sophisticated, context-aware prompt templates with multilingual support
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PromptTemplate } from './prompt-templates';

export interface TemplateVersion {
  id: string;
  version: string;
  name: string;
  description: string;
  language: 'pl' | 'en' | 'both';
  category:
    | 'thematic'
    | 'clustering'
    | 'contradictions'
    | 'insights'
    | 'recommendations';
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  performance: {
    avgConfidence: number;
    avgProcessingTime: number;
    usageCount: number;
    successRate: number;
  };
  abTesting?: {
    variant: 'A' | 'B';
    trafficSplit: number; // 0-100
  };
}

export interface TemplateContext {
  questionnaireType: string;
  language: 'pl' | 'en';
  responseCount: number;
  topic: string;
  workshopType?: string;
  participantDemographics?: {
    ageRange?: string;
    experience?: string;
    background?: string;
  };
  analysisOptions?: {
    minClusterSize?: number;
    includeSentiment?: boolean;
    anonymizationLevel?: 'partial' | 'full';
    customWeights?: Record<string, number>;
  };
}

export interface TemplateRenderingOptions {
  language?: 'pl' | 'en';
  fallbackLanguage?: boolean;
  includeExamples?: boolean;
  strictMode?: boolean;
  customVariables?: Record<string, any>;
  formatOptions?: {
    includeMetadata?: boolean;
    outputFormat?: 'json' | 'markdown' | 'text';
    prettyPrint?: boolean;
  };
}

export interface TemplateQualityMetrics {
  clarityScore: number; // 0-100
  completenessScore: number; // 0-100
  specificityScore: number; // 0-100
  culturalAdaptationScore: number; // 0-100
  tokenEfficiency: number; // tokens per result quality
  complianceScore: number; // GDPR, ethics, etc.
  overallScore: number; // weighted average
  recommendations: string[];
}

/**
 * Prompt Template Manager with advanced features
 */
export class PromptTemplateManager {
  private templateRegistry: Map<string, TemplateVersion> = new Map();
  private cache: Map<string, string> = new Map();
  private performanceMetrics: Map<string, any> = new Map();
  private readonly configPath: string;
  private readonly templatesDir: string;

  constructor(configPath?: string) {
    this.configPath =
      configPath ||
      join(process.cwd(), 'src', 'config', 'promptTemplates.json');
    this.templatesDir = join(process.cwd(), 'src', 'prompts');
    this.loadConfiguration();
    this.loadTemplates();
  }

  /**
   * Load template configuration from JSON file
   */
  private loadConfiguration(): void {
    if (existsSync(this.configPath)) {
      try {
        const config = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        // Load configuration settings
      } catch (error) {
        console.warn('Failed to load prompt template configuration:', error);
      }
    }
  }

  /**
   * Load all templates from file system
   */
  private loadTemplates(): void {
    const categories = [
      'thematicAnalysis',
      'clusteringAnalysis',
      'contradictionAnalysis',
      'insightsGeneration',
      'recommendationsEngine',
    ];

    for (const category of categories) {
      const categoryPath = join(this.templatesDir, category);
      if (existsSync(categoryPath)) {
        this.loadTemplatesFromCategory(category, categoryPath);
      }
    }
  }

  /**
   * Load templates from a specific category directory
   */
  private loadTemplatesFromCategory(
    category: string,
    categoryPath: string,
  ): void {
    // Implementation would scan directory and load template files
    // For now, register default templates
    this.registerDefaultTemplates();
  }

  /**
   * Register default built-in templates
   */
  private registerDefaultTemplates(): void {
    // Thematic Analysis Templates
    this.registerTemplate({
      id: 'thematic_analysis_v2_pl',
      version: '2.0',
      name: 'Zaawansowana Analiza Tematyczna (PL)',
      description:
        'Sophisticated thematic analysis with cultural context for Polish responses',
      language: 'pl',
      category: 'thematic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      performance: {
        avgConfidence: 0.85,
        avgProcessingTime: 2500,
        usageCount: 0,
        successRate: 0.95,
      },
    });

    this.registerTemplate({
      id: 'thematic_analysis_v2_en',
      version: '2.0',
      name: 'Advanced Thematic Analysis (EN)',
      description:
        'Sophisticated thematic analysis with cultural context for English responses',
      language: 'en',
      category: 'thematic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      performance: {
        avgConfidence: 0.85,
        avgProcessingTime: 2500,
        usageCount: 0,
        successRate: 0.95,
      },
    });

    // Clustering Analysis Templates
    this.registerTemplate({
      id: 'hierarchical_clustering_v2',
      version: '2.0',
      name: 'Advanced Hierarchical Clustering',
      description:
        'Enhanced clustering with semantic similarity and cultural context',
      language: 'both',
      category: 'clustering',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      performance: {
        avgConfidence: 0.82,
        avgProcessingTime: 3200,
        usageCount: 0,
        successRate: 0.92,
      },
    });

    // Contradiction Detection Templates
    this.registerTemplate({
      id: 'contradiction_detection_v2',
      version: '2.0',
      name: 'Advanced Contradiction Detection',
      description: 'Enhanced contradiction detection with context awareness',
      language: 'both',
      category: 'contradictions',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      performance: {
        avgConfidence: 0.78,
        avgProcessingTime: 2800,
        usageCount: 0,
        successRate: 0.88,
      },
    });

    // Insights Generation Templates
    this.registerTemplate({
      id: 'insights_generation_v2',
      version: '2.0',
      name: 'Advanced Insights Generation',
      description: 'Cross-question insights with pattern recognition',
      language: 'both',
      category: 'insights',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      performance: {
        avgConfidence: 0.8,
        avgProcessingTime: 3500,
        usageCount: 0,
        successRate: 0.9,
      },
    });

    // Recommendations Engine Templates
    this.registerTemplate({
      id: 'recommendations_engine_v2',
      version: '2.0',
      name: 'SMART Recommendations Engine',
      description: 'Intelligent recommendations with impact assessment',
      language: 'both',
      category: 'recommendations',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      performance: {
        avgConfidence: 0.88,
        avgProcessingTime: 4000,
        usageCount: 0,
        successRate: 0.94,
      },
    });
  }

  /**
   * Register a new template version
   */
  public registerTemplate(template: TemplateVersion): void {
    this.templateRegistry.set(template.id, template);
  }

  /**
   * Get optimal template based on context and performance
   */
  public getOptimalTemplate(
    category: string,
    context: TemplateContext,
    options: TemplateRenderingOptions = {},
  ): TemplateVersion | null {
    const candidates = Array.from(this.templateRegistry.values())
      .filter(t => t.category === category && t.isActive)
      .filter(t => t.language === context.language || t.language === 'both')
      .sort((a, b) => {
        // Sort by performance score, preferring more used templates
        const scoreA = a.performance.avgConfidence * a.performance.successRate;
        const scoreB = b.performance.avgConfidence * b.performance.successRate;
        return scoreB - scoreA;
      });

    return candidates[0] || null;
  }

  /**
   * Render template with context and options
   */
  public async renderTemplate(
    templateId: string,
    context: TemplateContext,
    variables: Record<string, any>,
    options: TemplateRenderingOptions = {},
  ): Promise<{
    renderedPrompt: string;
    template: TemplateVersion;
    qualityMetrics: TemplateQualityMetrics;
    tokenEstimate: number;
  }> {
    const template = this.templateRegistry.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(
      templateId,
      context,
      variables,
      options,
    );
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return {
        renderedPrompt: cached,
        template,
        qualityMetrics: this.calculateQualityMetrics(cached, template),
        tokenEstimate: this.estimateTokens(cached),
      };
    }

    // Load template content
    const templateContent = await this.loadTemplateContent(
      templateId,
      context.language,
    );

    // Process template with variables
    const renderedPrompt = this.processTemplate(
      templateContent,
      {
        ...context,
        ...variables,
        ...options.customVariables,
      },
      options,
    );

    // Cache the result
    this.cache.set(cacheKey, renderedPrompt);

    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(
      renderedPrompt,
      template,
    );

    return {
      renderedPrompt,
      template,
      qualityMetrics,
      tokenEstimate: this.estimateTokens(renderedPrompt),
    };
  }

  /**
   * Load template content from file system
   */
  private async loadTemplateContent(
    templateId: string,
    language: 'pl' | 'en',
  ): Promise<string> {
    // In a real implementation, this would load from appropriate template files
    // For now, return template content based on template ID
    const templates: Record<string, Record<string, string>> = {
      thematic_analysis_v2_pl: {
        system:
          'Jesteś zaawansowanym systemem analizy socjologicznej specjalizującym się w polskim kontekście kulturowym.',
        user: this.getThematicAnalysisTemplate('pl'),
      },
      thematic_analysis_v2_en: {
        system:
          'You are an advanced sociological analysis system specializing in English cultural context.',
        user: this.getThematicAnalysisTemplate('en'),
      },
      hierarchical_clustering_v2: {
        system:
          'You are an advanced clustering algorithm for qualitative data analysis.',
        user: this.getClusteringTemplate(language),
      },
      contradiction_detection_v2: {
        system:
          'You are an expert in detecting logical contradictions and inconsistencies in survey data.',
        user: this.getContradictionTemplate(language),
      },
      insights_generation_v2: {
        system:
          'You are a senior research analyst specializing in cross-pattern recognition in qualitative data.',
        user: this.getInsightsTemplate(language),
      },
      recommendations_engine_v2: {
        system:
          'You are an expert community design advisor with 20+ years of experience in cohousing and collaborative living.',
        user: this.getRecommendationsTemplate(language),
      },
    };

    const templateData = templates[templateId];
    if (!templateData) {
      throw new Error(`Template content not found for: ${templateId}`);
    }

    const systemLang = language === 'pl' ? 'pl' : 'en';
    const systemPrompt = templateData.system;
    const userPrompt = templateData.user;

    return JSON.stringify({
      system: systemPrompt,
      user: userPrompt,
    });
  }

  /**
   * Get thematic analysis template
   */
  private getThematicAnalysisTemplate(language: 'pl' | 'en'): string {
    if (language === 'pl') {
      return `
# ZADANIE: Zaawansowana Analiza Tematyczna

Przeprowadź głęboką analizę tematyczną odpowiedzi na kwestionariusz dotyczący wspólnoty, z uwzględnieniem polskiego kontekstu kulturowego.

# KONTEKST ANALIZY
- Typ kwestionariusza: {{questionnaireType}}
- Liczba odpowiedzi: {{responseCount}}
- Główny temat: {{topic}}
- Język analizy: Polski

# METODOLOGIA
1. **Identyfikacja tematów**: Wyodrębnij zarówno jawne, jak i ukryte tematy
2. **Kontekst kulturowy**: Uwzględnij polskie specyfiki kulturowe i społeczne
3. **Analiza sentymentu**: Oceń emocjonalny ton każdego tematu
4. **Powiązania**: Zidentyfikuj połączenia między tematami
5. **Wzorce**: Znajdź powtarzające się wzorce i tendencje

# INSTRUKCJE SZCZEGÓŁOWE

## Krok 1: Przygotowanie danych
- Przeczytaj wszystkie odpowiedzi uważnie, zwracając uwagę na niuanse językowe
- Zidentyfikuj kluczowe słowa i frazy charakterystyczne dla polskiego kontekstu
- Zauważ odniesienia kulturowe i społeczne

## Krok 2: Ekstrakcja tematów
Dla każdego zidentyfikowanego tematu podaj:
- **Nazwę tematu** (zwięzła, opisowa, max 60 znaków)
- **Częstotliwość** (liczba i procent odpowiedzi)
- **Kontekst kulturowy** (jak polskie wartości wpływają na ten temat)
- **Reprezentatywne przykłady** (2-3 cytaty, bez danych osobowych)
- **Sentyment** (-1 do +1, z uzasadnieniem)
- **Słowa kluczowe** (5-10 najważniejszych terminów)

## Krok 3: Analiza wzorców
Zidentyfikuj i opisz:
- Główne konflikty wartości
- Wspólne aspiracje i obawy
- Wpływ kontekstu społecznego
- Unikalne polskie perspektywy

# DANE WEJŚCIOWE
{{responses}}

# FORMAT WYJŚCIA - JSON
\`\`\`json
{
  "analysisSummary": {
    "totalResponses": {{responseCount}},
    "identifiedThemes": 5,
    "culturalContext": "polski kontekst społeczno-kulturowy",
    "keyInsights": ["kluczowe spostrzeżenia 1", "kluczowe spostrzeżenia 2"]
  },
  "themes": [
    {
      "id": "theme_1",
      "name": "Nazwa tematu",
      "frequency": {
        "count": 25,
        "percentage": 45.5
      },
      "culturalContext": "Opis wpływu polskiego kontekstu kulturowego",
      "examples": [
        {
          "quote": "cytat bez danych osobowych",
          "context": "krótki kontekst cytatu"
        }
      ],
      "sentiment": {
        "score": 0.6,
        "explanation": "Uzasadnienie oceny sentymentu"
      },
      "keywords": ["słowo1", "słowo2", "słowo3"],
      "relatedThemes": ["theme_2", "theme_3"]
    }
  ],
  "culturalPatterns": [
    {
      "pattern": "Wzorzec kulturowy",
      "description": "Opis wzorca",
      "frequency": 0.7,
      "impact": "medium"
    }
  ],
  "valueConflicts": [
    {
      "conflict": "Konflikt wartości",
      "description": "Opis konfliktu",
      "examples": ["przykład 1", "przykład 2"]
    }
  ],
  "qualityMetrics": {
    "confidence": 0.85,
    "completeness": 0.9,
    "culturalAdaptation": 0.95
  }
}
\`\`\`

# WAŻNE ZASADY
- Zachowaj pełną anonimowość respondentów
- Uwzględnij polskie konteksty kulturowe i historyczne
- Unikaj stereotypów i uproszczeń
- Podawaj tylko informacje poparte danymi
- Używaj precyzyjnego języka polskiego
- Szanuj złożoność polskiego społeczeństwa
`;
    } else {
      return `
# TASK: Advanced Thematic Analysis

Conduct a deep thematic analysis of questionnaire responses about community, with attention to English cultural context.

# ANALYSIS CONTEXT
- Questionnaire Type: {{questionnaireType}}
- Response Count: {{responseCount}}
- Main Topic: {{topic}}
- Analysis Language: English

# METHODOLOGY
1. **Theme Identification**: Extract both explicit and hidden themes
2. **Cultural Context**: Consider English cultural and social specifics
3. **Sentiment Analysis**: Assess emotional tone of each theme
4. **Connections**: Identify relationships between themes
5. **Patterns**: Find recurring patterns and tendencies

# DETAILED INSTRUCTIONS

## Step 1: Data Preparation
- Read all responses carefully, noting linguistic nuances
- Identify key words and phrases characteristic of English context
- Note cultural and social references

## Step 2: Theme Extraction
For each identified theme provide:
- **Theme Name** (concise, descriptive, max 60 characters)
- **Frequency** (count and percentage of responses)
- **Cultural Context** (how English values influence this theme)
- **Representative Examples** (2-3 quotes, no personal data)
- **Sentiment** (-1 to +1, with justification)
- **Keywords** (5-10 most important terms)

## Step 3: Pattern Analysis
Identify and describe:
- Major value conflicts
- Common aspirations and concerns
- Social context influence
- Unique English perspectives

# INPUT DATA
{{responses}}

# OUTPUT FORMAT - JSON
\`\`\`json
{
  "analysisSummary": {
    "totalResponses": {{responseCount}},
    "identifiedThemes": 5,
    "culturalContext": "English socio-cultural context",
    "keyInsights": ["key insight 1", "key insight 2"]
  },
  "themes": [
    {
      "id": "theme_1",
      "name": "Theme Name",
      "frequency": {
        "count": 25,
        "percentage": 45.5
      },
      "culturalContext": "Description of English cultural context influence",
      "examples": [
        {
          "quote": "quote without personal data",
          "context": "brief context of the quote"
        }
      ],
      "sentiment": {
        "score": 0.6,
        "explanation": "Sentiment score justification"
      },
      "keywords": ["word1", "word2", "word3"],
      "relatedThemes": ["theme_2", "theme_3"]
    }
  ],
  "culturalPatterns": [
    {
      "pattern": "Cultural Pattern",
      "description": "Pattern description",
      "frequency": 0.7,
      "impact": "medium"
    }
  ],
  "valueConflicts": [
    {
      "conflict": "Value Conflict",
      "description": "Conflict description",
      "examples": ["example 1", "example 2"]
    }
  ],
  "qualityMetrics": {
    "confidence": 0.85,
    "completeness": 0.9,
    "culturalAdaptation": 0.95
  }
}
\`\`\`

# IMPORTANT RULES
- Maintain complete respondent anonymity
- Consider English cultural and historical contexts
- Avoid stereotypes and oversimplifications
- Provide only data-supported information
- Use precise English language
- Respect the complexity of English society
`;
    }
  }

  /**
   * Get clustering analysis template
   */
  private getClusteringTemplate(language: 'pl' | 'en'): string {
    if (language === 'pl') {
      return `
# ZADANIE: Zaawansowana Analiza Klastrowa

Przeprowadź zaawansowaną analizę klastrową odpowiedzi, uwzględniając kontekst semantyczny i kulturowy.

# KONTEKST
- Liczba odpowiedzi: {{responseCount}}
- Minimalny rozmiar klastra: {{minClusterSize}}
- Język: Polski

# METODOLOGIA
1. **Przygotowanie semantyczne**: Generuj embeddingi dla odpowiedzi
2. **Analiza hierarchiczna**: Zastosuj aglomeracyjne klastrowanie
3. **Optymalizacja**: Określ optymalną liczbę klastrów
4. **Interpretacja**: Opisz każdy klaster w kontekście polskim

# WYJŚCIE JSON
{
  "clusteringAnalysis": {
    "method": "hierarchical",
    "optimalClusters": 5,
    "silhouetteScore": 0.72,
    "culturalContext": "polski kontekst kulturowy"
  },
  "clusters": [
    {
      "id": "cluster_1",
      "name": "Nazwa klastra",
      "size": 12,
      "percentage": 24.0,
      "centroid": "Najbardziej reprezentatywna odpowiedź",
      "characteristics": ["charakterystyka1", "charakterystyka2"],
      "culturalNotes": "Uwagi dotyczące polskiego kontekstu",
      "sentiment": 0.6,
      "cohesion": 0.8,
      "members": ["id1", "id2"]
    }
  ]
}
`;
    } else {
      return `
# TASK: Advanced Clustering Analysis

Conduct advanced clustering analysis of responses, considering semantic and cultural context.

# CONTEXT
- Response Count: {{responseCount}}
- Minimum Cluster Size: {{minClusterSize}}
- Language: English

# METHODOLOGY
1. **Semantic Preparation**: Generate embeddings for responses
2. **Hierarchical Analysis**: Apply agglomerative clustering
3. **Optimization**: Determine optimal cluster count
4. **Interpretation**: Describe each cluster in English context

# OUTPUT JSON
{
  "clusteringAnalysis": {
    "method": "hierarchical",
    "optimalClusters": 5,
    "silhouetteScore": 0.72,
    "culturalContext": "English cultural context"
  },
  "clusters": [
    {
      "id": "cluster_1",
      "name": "Cluster Name",
      "size": 12,
      "percentage": 24.0,
      "centroid": "Most representative response",
      "characteristics": ["characteristic1", "characteristic2"],
      "culturalNotes": "English context notes",
      "sentiment": 0.6,
      "cohesion": 0.8,
      "members": ["id1", "id2"]
    }
  ]
}
`;
    }
  }

  /**
   * Get contradiction detection template
   */
  private getContradictionTemplate(language: 'pl' | 'en'): string {
    if (language === 'pl') {
      return `
# ZADANIE: Wykrywanie Sprzeczności

Zidentyfikuj sprzeczności i niespójności w odpowiedziach uczestników.

# TYPY SPRZECZNOŚCI
1. Logiczne (bezpośrednie przeciwieństwa)
2. Wartościowe (konflikt wartości)
3. Praktyczne (niezgodności w planach)
4. Czasowe (teraz vs przyszłość)

# WYJŚCIE JSON
{
  "contradictionAnalysis": {
    "totalContradictions": 3,
    "severityDistribution": {"low": 1, "medium": 1, "high": 1}
  },
  "contradictions": [
    {
      "id": "contradiction_1",
      "type": "logiczna",
      "severity": "medium",
      "description": "Opis sprzeczności",
      "examples": ["przykład1", "przykład2"],
      "frequency": 15,
      "possibleCauses": ["przyczyna1", "przyczyna2"],
      "resolutionSuggestions": ["sugestia1", "sugestia2"]
    }
  ]
}
`;
    } else {
      return `
# TASK: Contradiction Detection

Identify contradictions and inconsistencies in participant responses.

# CONTRADICTION TYPES
1. Logical (direct oppositions)
2. Value-based (value conflicts)
3. Practical (inconsistencies in plans)
4. Temporal (present vs future)

# OUTPUT JSON
{
  "contradictionAnalysis": {
    "totalContradictions": 3,
    "severityDistribution": {"low": 1, "medium": 1, "high": 1}
  },
  "contradictions": [
    {
      "id": "contradiction_1",
      "type": "logical",
      "severity": "medium",
      "description": "Contradiction description",
      "examples": ["example1", "example2"],
      "frequency": 15,
      "possibleCauses": ["cause1", "cause2"],
      "resolutionSuggestions": ["suggestion1", "suggestion2"]
    }
  ]
}
`;
    }
  }

  /**
   * Get insights generation template
   */
  private getInsightsTemplate(language: 'pl' | 'en'): string {
    if (language === 'pl') {
      return `
# ZADANIE: Generowanie Insightów

Wyciągnij zaawansowane insighty z analizy międzysekcjonalnej.

# METODOLOGIA
1. Analiza krzyżowa między sekcjami
2. Identyfikacja ukrytych potrzeb
3. Rozpoznawanie wzorców kulturowych
4. Przewidywanie trendów

# WYJŚCIE JSON
{
  "insightsAnalysis": {
    "totalInsights": 5,
    "averageConfidence": 0.78,
    "crossSectionPatterns": 3
  },
  "insights": [
    {
      "id": "insight_1",
      "category": "kategoria",
      "title": "Tytuł insightu",
      "description": "Szczegółowy opis",
      "confidence": 0.85,
      "sources": ["źródło1", "źródło2"],
      "implications": ["implikacja1", "implikacja2"],
      "actionability": true,
      "novelty": "medium"
    }
  ]
}
`;
    } else {
      return `
# TASK: Insights Generation

Extract advanced insights from cross-sectional analysis.

# METHODOLOGY
1. Cross-section analysis between sections
2. Hidden needs identification
3. Cultural pattern recognition
4. Trend prediction

# OUTPUT JSON
{
  "insightsAnalysis": {
    "totalInsights": 5,
    "averageConfidence": 0.78,
    "crossSectionPatterns": 3
  },
  "insights": [
    {
      "id": "insight_1",
      "category": "category",
      "title": "Insight Title",
      "description": "Detailed description",
      "confidence": 0.85,
      "sources": ["source1", "source2"],
      "implications": ["implication1", "implication2"],
      "actionability": true,
      "novelty": "medium"
    }
  ]
}
`;
    }
  }

  /**
   * Get recommendations template
   */
  private getRecommendationsTemplate(language: 'pl' | 'en'): string {
    if (language === 'pl') {
      return `
# ZADANIE: Inteligentne Rekomendacje SMART

Generuj konkretnie, mierzalne i osiągalne rekomendacje.

# METODOLOGIA SMART
- **Specific** (Konkretne)
- **Measurable** (Mierzalne)
- **Achievable** (Osiągalne)
- **Relevant** (Istotne)
- **Time-bound** (W ramach terminu)

# KONTEKST PROJEKTU
- Typ wspólnoty: {{communityType}}
- Liczba mieszkańców: {{residentCount}}
- Budżet: {{budgetStatus}}

# WYJŚCIE JSON
{
  "recommendationsReport": {
    "totalRecommendations": 5,
    "priorityDistribution": {"high": 2, "medium": 2, "low": 1},
    "estimatedImplementationTime": "6-12 months"
  },
  "recommendations": [
    {
      "id": "rec_1",
      "priority": "high",
      "category": "przestrzeń",
      "title": "Tytuł rekomendacji",
      "description": "Szczegółowy opis",
      "smartCriteria": {
        "specific": "Konkretny cel",
        "measurable": "Wskaźniki sukcesu",
        "achievable": "Osiągalność",
        "relevant": "Istotność",
        "timebound": "Ram czasowe"
      },
      "estimatedCost": "koszt",
      "expectedImpact": 0.9,
      "dependencies": ["zależność1", "zależność2"],
      "successIndicators": ["wskaźnik1", "wskaźnik2"]
    }
  ]
}
`;
    } else {
      return `
# TASK: SMART Recommendations Engine

Generate specific, measurable, and achievable recommendations.

# SMART METHODOLOGY
- **Specific** (Concrete)
- **Measurable** (Measurable)
- **Achievable** (Achievable)
- **Relevant** (Relevant)
- **Time-bound** (Time-framed)

# PROJECT CONTEXT
- Community Type: {{communityType}}
- Resident Count: {{residentCount}}
- Budget: {{budgetStatus}}

# OUTPUT JSON
{
  "recommendationsReport": {
    "totalRecommendations": 5,
    "priorityDistribution": {"high": 2, "medium": 2, "low": 1},
    "estimatedImplementationTime": "6-12 months"
  },
  "recommendations": [
    {
      "id": "rec_1",
      "priority": "high",
      "category": "space",
      "title": "Recommendation Title",
      "description": "Detailed description",
      "smartCriteria": {
        "specific": "Specific goal",
        "measurable": "Success indicators",
        "achievable": "Achievability",
        "relevant": "Relevance",
        "timebound": "Time frame"
      },
      "estimatedCost": "cost",
      "expectedImpact": 0.9,
      "dependencies": ["dependency1", "dependency2"],
      "successIndicators": ["indicator1", "indicator2"]
    }
  ]
}
`;
    }
  }

  /**
   * Process template with variable substitution
   */
  private processTemplate(
    template: string,
    variables: Record<string, any>,
    options: TemplateRenderingOptions,
  ): string {
    const processed = template;

    // Parse JSON template if needed
    let templateObj: any;
    try {
      templateObj = JSON.parse(template);
    } catch {
      // If not JSON, treat as plain text
      templateObj = { system: 'You are a helpful assistant.', user: template };
    }

    // Process variables in both system and user prompts
    const processText = (text: string): string => {
      let result = text;

      // Simple variable substitution {{variable}}
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, String(value));
      }

      // Handle conditional blocks {{#if variable}}...{{/if}}
      result = result.replace(
        /{{#if\s+(\w+)}}(.*?){{\/if}}/gs,
        (match, varName, content) => {
          const value = variables[varName];
          return value ? content : '';
        },
      );

      // Handle loops {{#each array}}...{{/each}}
      result = result.replace(
        /{{#each\s+(\w+)}}(.*?){{\/each}}/gs,
        (match, varName, content) => {
          const array = variables[varName];
          if (Array.isArray(array)) {
            return array
              .map((item, index) => {
                let itemContent = content;
                itemContent = itemContent.replace(/{{this}}/g, String(item));
                itemContent = itemContent.replace(/{{@index}}/g, String(index));
                return itemContent;
              })
              .join('\n');
          }
          return '';
        },
      );

      return result;
    };

    templateObj.system = processText(templateObj.system);
    templateObj.user = processText(templateObj.user);

    return JSON.stringify(templateObj);
  }

  /**
   * Calculate quality metrics for rendered prompt
   */
  private calculateQualityMetrics(
    prompt: string,
    template: TemplateVersion,
  ): TemplateQualityMetrics {
    const clarityScore = this.calculateClarityScore(prompt);
    const completenessScore = this.calculateCompletenessScore(prompt);
    const specificityScore = this.calculateSpecificityScore(prompt);
    const culturalAdaptationScore =
      this.calculateCulturalAdaptationScore(prompt);
    const tokenEfficiency = this.calculateTokenEfficiency(prompt);
    const complianceScore = this.calculateComplianceScore(prompt);

    const overallScore =
      clarityScore * 0.2 +
      completenessScore * 0.2 +
      specificityScore * 0.2 +
      culturalAdaptationScore * 0.2 +
      tokenEfficiency * 0.1 +
      complianceScore * 0.1;

    const recommendations = this.generateRecommendations({
      clarityScore,
      completenessScore,
      specificityScore,
      culturalAdaptationScore,
      tokenEfficiency,
      complianceScore,
    });

    return {
      clarityScore,
      completenessScore,
      specificityScore,
      culturalAdaptationScore,
      tokenEfficiency,
      complianceScore,
      overallScore,
      recommendations,
    };
  }

  /**
   * Individual quality metric calculators
   */
  private calculateClarityScore(prompt: string): number {
    // Implementation would analyze prompt clarity
    return Math.min(100, prompt.length / 10); // Simple placeholder
  }

  private calculateCompletenessScore(prompt: string): number {
    // Check for required sections
    const requiredSections = ['ZADANIE', 'INSTRUKCJE', 'FORMAT'];
    const presentSections = requiredSections.filter(section =>
      prompt.includes(section),
    ).length;
    return (presentSections / requiredSections.length) * 100;
  }

  private calculateSpecificityScore(prompt: string): number {
    // Measure how specific the instructions are
    return Math.min(100, prompt.split('.').length * 5); // Simple placeholder
  }

  private calculateCulturalAdaptationScore(prompt: string): number {
    // Check for cultural adaptation markers
    const culturalMarkers = [
      'kontekst kulturowy',
      'cultural context',
      'polski',
      'polish',
    ];
    const presentMarkers = culturalMarkers.filter(marker =>
      prompt.toLowerCase().includes(marker.toLowerCase()),
    ).length;
    return (presentMarkers / culturalMarkers.length) * 100;
  }

  private calculateTokenEfficiency(prompt: string): number {
    const tokenCount = this.estimateTokens(prompt);
    const qualityIndicators = prompt.split('\n').length;
    return Math.min(100, (qualityIndicators / tokenCount) * 100);
  }

  private calculateComplianceScore(prompt: string): number {
    // Check for GDPR compliance, ethics, etc.
    const complianceMarkers = [
      'anonimowość',
      'anonimity',
      'dane osobowe',
      'personal data',
    ];
    const presentMarkers = complianceMarkers.filter(marker =>
      prompt.toLowerCase().includes(marker.toLowerCase()),
    ).length;
    return (presentMarkers / complianceMarkers.length) * 100;
  }

  private generateRecommendations(scores: any): string[] {
    const recommendations: string[] = [];

    if (scores.clarityScore < 70) {
      recommendations.push(
        'Improve prompt clarity by adding more specific instructions',
      );
    }
    if (scores.completenessScore < 80) {
      recommendations.push('Add missing required sections to the template');
    }
    if (scores.specificityScore < 60) {
      recommendations.push('Include more concrete examples and constraints');
    }
    if (scores.culturalAdaptationScore < 50) {
      recommendations.push('Add more cultural context and adaptation');
    }
    if (scores.complianceScore < 80) {
      recommendations.push('Strengthen privacy and compliance instructions');
    }

    return recommendations;
  }

  /**
   * Estimate token count for a text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate cache key for template rendering
   */
  private generateCacheKey(
    templateId: string,
    context: TemplateContext,
    variables: Record<string, any>,
    options: TemplateRenderingOptions,
  ): string {
    const keyData = {
      templateId,
      context,
      variables,
      options,
    };
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Update template performance metrics
   */
  public updatePerformanceMetrics(
    templateId: string,
    metrics: {
      confidence: number;
      processingTime: number;
      success: boolean;
    },
  ): void {
    const template = this.templateRegistry.get(templateId);
    if (!template) return;

    const current = template.performance;
    const usageCount = current.usageCount + 1;

    template.performance = {
      avgConfidence:
        (current.avgConfidence * current.usageCount + metrics.confidence) /
        usageCount,
      avgProcessingTime:
        (current.avgProcessingTime * current.usageCount +
          metrics.processingTime) /
        usageCount,
      usageCount,
      successRate:
        (current.successRate * current.usageCount + (metrics.success ? 1 : 0)) /
        usageCount,
    };

    this.templateRegistry.set(templateId, template);
  }

  /**
   * Get template performance report
   */
  public getPerformanceReport(): {
    totalTemplates: number;
    activeTemplates: number;
    categoryPerformance: Record<string, any>;
    topPerformers: TemplateVersion[];
    recommendations: string[];
    } {
    const templates = Array.from(this.templateRegistry.values());
    const activeTemplates = templates.filter(t => t.isActive);

    const categoryPerformance: Record<string, any> = {};
    activeTemplates.forEach(template => {
      if (!categoryPerformance[template.category]) {
        categoryPerformance[template.category] = {
          count: 0,
          avgConfidence: 0,
          avgSuccessRate: 0,
          totalUsage: 0,
        };
      }

      const cat = categoryPerformance[template.category];
      cat.count++;
      cat.avgConfidence += template.performance.avgConfidence;
      cat.avgSuccessRate += template.performance.successRate;
      cat.totalUsage += template.performance.usageCount;
    });

    // Calculate averages
    Object.values(categoryPerformance).forEach(cat => {
      cat.avgConfidence /= cat.count;
      cat.avgSuccessRate /= cat.count;
    });

    const topPerformers = activeTemplates
      .sort((a, b) => {
        const scoreA = a.performance.avgConfidence * a.performance.successRate;
        const scoreB = b.performance.avgConfidence * b.performance.successRate;
        return scoreB - scoreA;
      })
      .slice(0, 5);

    const recommendations =
      this.generateSystemRecommendations(categoryPerformance);

    return {
      totalTemplates: templates.length,
      activeTemplates: activeTemplates.length,
      categoryPerformance,
      topPerformers,
      recommendations,
    };
  }

  private generateSystemRecommendations(
    categoryPerformance: Record<string, any>,
  ): string[] {
    const recommendations: string[] = [];

    Object.entries(categoryPerformance).forEach(
      ([category, perf]: [string, any]) => {
        if (perf.avgConfidence < 0.8) {
          recommendations.push(
            `Consider updating ${category} templates to improve confidence scores`,
          );
        }
        if (perf.avgSuccessRate < 0.9) {
          recommendations.push(
            `Review ${category} templates for better success rates`,
          );
        }
        if (perf.totalUsage < 10) {
          recommendations.push(
            `Consider A/B testing ${category} templates to gather more performance data`,
          );
        }
      },
    );

    return recommendations;
  }

  /**
   * Clear template cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Export template configuration
   */
  public exportConfiguration(): string {
    const config = {
      templates: Array.from(this.templateRegistry.values()),
      metadata: {
        exportDate: new Date().toISOString(),
        version: '2.0',
        categories: [
          'thematic',
          'clustering',
          'contradictions',
          'insights',
          'recommendations',
        ],
      },
    };
    return JSON.stringify(config, null, 2);
  }
}

// Export singleton instance
export const promptTemplateManager = new PromptTemplateManager();
