/**
 * Prompt template service for LLM analysis
 * Provides structured, validated prompts for different analysis types
 */

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'analysis' | 'processing' | 'validation';
  template: string;
  requiredVars: string[];
  optionalVars: string[];
  constraints: {
    maxInputLength?: number;
    maxOutputLength?: number;
    temperature?: number;
    maxTokens?: number;
  };
  examples?: Array<{
    input: any;
    output: any;
  }>;
  culturalBiasMitigation?: boolean;
  multilingualSupport?: string[];
}

export interface PromptVariables {
  [key: string]: any;
}

/**
 * Thematic Analysis Prompts
 */
const THEMATIC_ANALYSIS_TEMPLATES: PromptTemplate[] = [
  {
    id: 'thematic-analysis-v1',
    name: 'Thematic Analysis - Standard',
    version: '1.0',
    description: 'Extract themes and patterns from questionnaire responses',
    category: 'analysis',
    template: `Jesteś ekspertem socjologiem analizującym odpowiedzi na kwestionariusz dotyczący wspólnoty mieszkaniowej.

# ZADANIE
Przeanalizuj poniższe anonimowe odpowiedzi i wyodrębnij kluczowe tematy.

# KONTEKST
Analiza dotyczy odpowiedzi na pytanie: {{questionText}}
Liczba odpowiedzi: {{responseCount}}
Język odpowiedzi: {{language}}

# INSTRUKCJE
1. Przeczytaj wszystkie odpowiedzi uważnie
2. Zidentyfikuj powtarzające się motywy i wartości
3. Dla każdego tematu:
   - Nadaj krótką, opisową nazwę (maks. 60 znaków)
   - Policz częstotliwość występowania
   - Wybierz 2-3 reprezentatywne cytaty (bez identyfikacji autorów)
   - Oceń sentyment: pozytywny/neutralny/negatywny (-1 do 1)
4. Uporządkuj tematy od najczęstszych
5. Podaj ogólne podsumowanie wzorców

# ODPOWIEDZI DO ANALIZY
{{responses}}

# FORMAT WYJŚCIA
Odpowiedz TYLKO w formacie JSON:
{
  "summary": "Krótkie podsumowanie głównych wzorców w odpowiedziach (maks. 200 znaków)",
  "themes": [
    {
      "name": "Nazwa tematu",
      "frequency": 12,
      "percentage": 24.0,
      "examples": ["cytat 1", "cytat 2", "cytat 3"],
      "sentiment": 0.7,
      "keywords": ["słowo1", "słowo2", "słowo3"]
    }
  ],
  "totalResponses": {{responseCount}},
  "uniqueThemes": 5,
  "language": "{{language}}"
}

# OGRANICZENIA
- NIE ujawniaj żadnych danych osobowych
- NIE spekuluj o tożsamości respondentów
- Trzymaj się faktów z odpowiedzi
- Unikaj subiektywnych interpretacji
- Minimum 3 tematy, maksimum 10 tematów`,
    requiredVars: ['responses', 'responseCount', 'questionText', 'language'],
    optionalVars: ['minFrequency'],
    constraints: {
      maxInputLength: 50000,
      maxOutputLength: 2000,
      temperature: 0.3,
      maxTokens: 1500,
    },
  },
  {
    id: 'sentiment-analysis-v1',
    name: 'Sentiment Analysis',
    version: '1.0',
    description: 'Analyze sentiment and emotional tone of responses',
    category: 'analysis',
    culturalBiasMitigation: true,
    multilingualSupport: ['pl', 'en'],
    template: `Jesteś ekspertem od analizy sentymentu w tekstach socjologicznych z uwzględnieniem kontekstu kulturowego.

# ZADANIE
Analizuj emocjonalny ton i sentyment odpowiedzi na kwestionariusz: {{questionText}}

# KONTEKST
Liczba odpowiedzi: {{responseCount}}
Język: {{language}}
Kontekst kulturowy: {{culturalContext}}

# INSTRUKCJE
1. Oceń ogólny sentyment (-1 do +1) z uwzględnieniem specyfiki kulturowej
2. Zidentyfikuj główne emocje (radość, nadzieja, obawa, złość, etc.)
3. Znajdź kontrastujące opinie i ich kontekst
4. Podaj wskazówki dla moderatora uwzględniające kontekst kulturowy
5. Uwzględnij normy kulturowe w wyrażaniu emocji

{{#if enableCulturalBias}}
## WSKAZÓWKI KULTUROWE
- W języku polskim emocje mogą być wyrażane bardziej powściągliwie
- Negatywne opinie mogą być formułowane bardziej pośrednio
- Nie interpretuj braku entuzjazmu jako braku zaangażowania
- Uwzględnij kontekst historyczny i społeczny
{{/if}}

# ODPOWIEDZI
{{responses}}

# FORMAT JSON
{
  "overallSentiment": 0.3,
  "emotionDistribution": {
    "positive": 0.4,
    "neutral": 0.3,
    "negative": 0.3
  },
  "dominantEmotions": [
    {
      "emotion": "nadzieja",
      "intensity": 0.7,
      "frequency": 12,
      "examples": ["przykład 1", "przykład 2"]
    }
  ],
  "contrastingViews": [
    {
      "positive": ["pozytywna opinia 1", "pozytywna opinia 2"],
      "negative": ["negatywna opinia 1", "negatywna opinia 2"],
      "neutral": ["neutralna opinia 1", "neutralna opinia 2"]
    }
  ],
  "culturalContextNotes": [
    "Notatka dotycząca kontekstu kulturowego",
    "Obserwacje specyficzne dla kultury"
  ],
  "moderatorNotes": [
    "wskazówka 1",
    "wskazówka 2"
  ],
  "sentimentByTheme": [
    {
      "theme": "temat 1",
      "sentiment": 0.5,
      "confidence": 0.8
    }
  ]
}`,
    requiredVars: ['responses', 'questionText', 'responseCount', 'language', 'culturalContext'],
    optionalVars: ['enableCulturalBias'],
    constraints: {
      temperature: 0.2,
      maxTokens: 1200,
    },
  },
];

/**
 * Clustering Analysis Prompts
 */
const CLUSTERING_TEMPLATES: PromptTemplate[] = [
  {
    id: 'hierarchical-clustering-v1',
    name: 'Hierarchical Clustering Analysis',
    version: '1.0',
    description: 'Group similar responses into clusters',
    category: 'analysis',
    template: `Jesteś algorytmem clusteringu dla danych jakościowych.

# ZADANIE
Pogrupuj podobne odpowiedzi w klastry reprezentujące wspólne perspektywy.

# KROKI
1. Dla każdej odpowiedzi wygeneruj reprezentację semantyczną
2. Zastosuj hierarchical clustering (ward linkage)
3. Określ optymalną liczbę klastrów (elbow method, 2-10 klastrów)
4. Dla każdego klastra:
   - Określ centroid (najbardziej reprezentatywna odpowiedź)
   - Wylistuj ID odpowiedzi (anonimowe)
   - Scharakteryzuj wspólne cechy
   - Nadaj nazwę klastra

# DANE WEJŚCIOWE
Liczba odpowiedzi: {{responseCount}}
Minimalny rozmiar klastra: {{minClusterSize}}
{{#if hasEmbeddings}}
Embeddings available: true
{{/if}}

# ODPOWIEDZI DO ANALIZY
{{responses}}

# FORMAT WYJŚCIA JSON
{
  "optimalClusters": 5,
  "clusteringMethod": "hierarchical",
  "linkageMethod": "ward",
  "clusters": [
    {
      "id": "cluster_1",
      "name": "Wspólnota i współpraca",
      "size": 8,
      "percentage": 32.0,
      "centroid": "Wspólna przestrzeń do pracy zdalnej i wzajemnej pomocy",
      "members": ["anon_uuid_1", "anon_uuid_2", "anon_uuid_3"],
      "characteristics": ["praca zdalna", "współdzielenie", "wzajemna pomoc", "cisza"],
      "sentiment": 0.6,
      "cohesionScore": 0.8
    }
  ],
  "totalResponses": {{responseCount}},
  "silhouetteScore": 0.65,
  "qualityMetrics": {
    "intraClusterSimilarity": 0.7,
    "interClusterDistance": 0.5
  }
}`,
    requiredVars: ['responses', 'responseCount'],
    optionalVars: ['minClusterSize', 'hasEmbeddings'],
    constraints: {
      temperature: 0.2,
      maxTokens: 2000,
    },
  },
];

/**
 * Contradictions Detection Prompts
 */
const CONTRADICTIONS_TEMPLATES: PromptTemplate[] = [
  {
    id: 'contradiction-detection-v1',
    name: 'Contradictions Analysis',
    version: '1.0',
    description: 'Detect inconsistencies and contradictions in responses',
    category: 'analysis',
    template: `Jesteś ekspertem od analizy spójności w badaniach socjologicznych.

# ZADANIE
Zidentyfikuj sprzeczności i niespójności w odpowiedziach uczestników.

# KONTEKST
Analiza odpowiedzi na powiązane pytania w kwestionariuszu:
- Pytanie 1: {{question1Text}}
- Pytanie 2: {{question2Text}}

# TYPY SPRZECZNOŚCI DO SZUKANIA
1. Logiczne sprzeczności (np. "chcę ciszy" vs "lubie głośne rozmowy")
2. Wartościowe konflikty (np. "autonomia" vs "współpraca")
3. Praktyczne niezgodności (np. "praca zdalna" vs "brak biura")
4. Czasowe rozbieżności (np. "teraz" vs "przyszłość")

# INSTRUKCJE
1. Porównaj odpowiedzi na powiązane pytania
2. Zidentyfikuj konkretne pary sprzecznych odpowiedzi
3. Oceń powagę sprzeczności (low/medium/high)
4. Podaj przykłady cytując anonimowe odpowiedzi
5. Zasugeruj możliwe przyczyny sprzeczności

# ODPOWIEDZI
{{responses}}

# FORMAT JSON
{
  "contradictions": [
    {
      "id": "contradiction_1",
      "questionPair": ["{{question1Id}}", "{{question2Id}}"],
      "type": "logiczna",
      "severity": "medium",
      "description": "Uczestnicy chcą ciszy do pracy, ale jednocześnie otwartej przestrzeni współpracy",
      "examples": [
        {
          "response1": "Potrzebuję absolutnej ciszy do skupienia",
          "response2": "Chcę otwartej przestrzeni do rozmów z zespołem"
        }
      ],
      "frequency": 15,
      "percentage": 30.0,
      "possibleCauses": ["różne potrzeby w zależności od zadania", "brak świadomości kompromisów"],
      "resolutionSuggestions": ["strefy ciche", "godziny ciszy", "kontenery akustyczne"]
    }
  ],
  "totalContradictions": 3,
  "mostCommonType": "logiczna",
  "severityDistribution": {
    "low": 1,
    "medium": 1,
    "high": 1
  }
}`,
    requiredVars: [
      'responses',
      'question1Text',
      'question2Text',
      'question1Id',
      'question2Id',
    ],
    optionalVars: [],
    constraints: {
      temperature: 0.3,
      maxTokens: 1500,
    },
  },
];

/**
 * Insights Extraction Prompts
 */
const INSIGHTS_TEMPLATES: PromptTemplate[] = [
  {
    id: 'insights-extraction-v1',
    name: 'Cross-Question Insights',
    version: '1.0',
    description: 'Extract hidden insights and patterns across questions',
    category: 'analysis',
    template: `Działasz jako senior research analyst specjalizujący się w analizie danych jakościowych.

# ZADANIE
Wyciągnij nieoczywiste insighty z odpowiedzi na kwestionariusz wspólnotowy.

# METODOLOGIA
1. Przeanalizuj odpowiedzi cross-question (między sekcjami)
2. Szukaj:
   - Niespodziewanych korelacji
   - Ukrytych potrzeb (nie wyrażonych wprost)
   - Potencjalnych konfliktów wartości
   - Nieobsługiwanych przypadków użycia
   - Wzorców kulturowych i społecznych
3. Oceń confidence każdego insightu (0-1)
4. Podaj źródła (ID anonimowych odpowiedzi)

# DANE SEKCYJNE
Sekcja 1 (Wizja): {{section1Responses}}
Sekcja 2 (Przestrzeń): {{section2Responses}}
Sekcja 3 (Relacje): {{section3Responses}}
Sekcja 4 (Organizowanie): {{section4Responses}}

# KONTEKST
Temat warsztatu: {{workshopTheme}}
Liczba uczestników: {{participantCount}}
Czas trwania: {{duration}}

# WYJŚCIE JSON
{
  "insights": [
    {
      "id": "insight_1",
      "category": "Konflikt potrzeb",
      "title": "Praca zdalna vs integracja społeczna",
      "text": "30% uczestników pragnie ciszy do pracy zdalnej, ale 80% chce wspólnych przestrzeni - potencjalny konflikt wymagający rozwiązania",
      "confidence": 0.85,
      "sources": ["anon_1", "anon_3", "anon_12"],
      "crossSectionReferences": ["sekcja_1", "sekcja_2"],
      "implications": ["potrzeba projektowania stref hybrydowych", "harmonogramowanie pracy"],
      "actionable": true,
      "novelty": "medium"
    }
  ],
  "patterns": [
    {
      "pattern": "Wzorzec hybrydowy",
      "description": "Uczestnicy oczekują elastyczności w trybach pracy",
      "frequency": 0.7
    }
  ],
  "hiddenNeeds": [
    "Potrzeba prywatności w otwartej przestrzeni",
    "Elastyczność godzin pracy w wspólnotie"
  ],
  "culturalInsights": [
    "Silne potrzeby autonomii przy jednoczesnej chęci współpracy"
  ],
  "totalInsights": 5,
  "averageConfidence": 0.75
}`,
    requiredVars: [
      'section1Responses',
      'section2Responses',
      'section3Responses',
      'section4Responses',
    ],
    optionalVars: ['workshopTheme', 'participantCount', 'duration'],
    constraints: {
      temperature: 0.4,
      maxTokens: 2000,
    },
  },
];

/**
 * Recommendations Prompts
 */
const RECOMMENDATIONS_TEMPLATES: PromptTemplate[] = [
  {
    id: 'smart-recommendations-v1',
    name: 'SMART Recommendations Generator',
    version: '1.0',
    description: 'Generate actionable, SMART recommendations based on analysis',
    category: 'analysis',
    template: `Jesteś doradcą wspólnotowym z 20-letnim doświadczeniem w cohousing i projektowaniu społeczności.

# ZADANIE
Na podstawie analizy odpowiedzi zaproponuj konkretne rekomendacje dla projektantów wspólnoty.

# KONTEKST ANALIZY
Wyniki analiz:
- Tematy: {{themesSummary}}
- Klastry: {{clustersSummary}}
- Sprzeczności: {{contradictionsSummary}}
- Insighty: {{insightsSummary}}

# INFORMACJE O PROJEKCIE
Typ wspólnoty: {{communityType}}
Liczba mieszkańców: {{residentCount}}
Budżet: {{budgetStatus}}
Lokalizacja: {{locationType}}

# KROKI
1. Przeanalizuj wszystkie wyniki razem
2. Zidentyfikuj top 5-10 obszarów wymagających uwagi
3. Dla każdego zaproponuj:
   - Konkretne działanie (Specific)
   - Mierzalny cel (Measurable)
   - Osiągalność (Achievable)
   - Istotność (Relevant)
   - Ramy czasowe (Time-bound)
   - Uzasadnienie oparte na danych

# PRIORYTETY REKOMENDACJI
- High: Krytyczne dla funkcjonowania wspólnoty
- Medium: Ważne dla poprawy jakości życia
- Low: Pożądane ulepszenia

# FORMAT JSON
{
  "recommendations": [
    {
      "id": "rec_1",
      "priority": "high",
      "category": "Przestrzeń",
      "title": "Strefa hybrydowa pracy i współpracy",
      "description": "Zaprojektuj strefę ciszy oddzieloną od wspólnej przestrzeni współpracy",
      "action": "Utworzenie dwóch stref: cichej (8 stanowisk) i collaborative (12 miejsc)",
      "metrics": {
        "specific": "Liczba miejsc w strefie cichej i collaborative",
        "measurable": "Zadowolenie mieszkańców >80%",
        "achievable": "W ramach istniejącego budżetu 50k PLN",
        "relevant": "Rozwiązuje konflikt ciszy vs współpracy",
        "timebound": "Implementacja w ciągu 3 miesięcy"
      },
      "rationale": "30% mieszkańców potrzebuje ciszy do pracy, 80% chce przestrzeni współpracy",
      "dataSource": "kontrastujące odpowiedzi w sekcji Przestrzeń",
      "estimatedCost": "45000 PLN",
      "estimatedImpact": 0.9,
      "dependencies": ["projekt architektoniczny", "zakup mebli"],
      "successIndicators": [
        "Wzrost produktywności pracy zdalnej",
        "Zwiększenie interakcji społecznych"
      ]
    }
  ],
  "implementationPlan": {
    "phase1": ["rec_1", "rec_2"],
    "phase2": ["rec_3", "rec_4"],
    "phase3": ["rec_5"]
  },
  "totalRecommendations": 5,
  "priorityDistribution": {
    "high": 2,
    "medium": 2,
    "low": 1
  },
  "estimatedTotalCost": "150000 PLN"
}`,
    requiredVars: [
      'themesSummary',
      'clustersSummary',
      'contradictionsSummary',
      'insightsSummary',
    ],
    optionalVars: [
      'communityType',
      'residentCount',
      'budgetStatus',
      'locationType',
    ],
    constraints: {
      temperature: 0.3,
      maxTokens: 2500,
    },
  },
];

/**
 * Prompt Template Service
 */
export class PromptTemplateService {
  private templates: Map<string, PromptTemplate> = new Map();
  private templateVersions: Map<string, string> = new Map();

  constructor() {
    this.loadTemplates();
  }

  /**
   * Load all prompt templates
   */
  private loadTemplates(): void {
    const allTemplates = [
      ...THEMATIC_ANALYSIS_TEMPLATES,
      ...CLUSTERING_TEMPLATES,
      ...CONTRADICTIONS_TEMPLATES,
      ...INSIGHTS_TEMPLATES,
      ...RECOMMENDATIONS_TEMPLATES,
    ];

    for (const template of allTemplates) {
      this.templates.set(template.id, template);
      this.templateVersions.set(
        template.id.replace(/-v\d+$/, ''),
        template.version,
      );
    }
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get current version of template type
   */
  getCurrentVersion(templateType: string): string {
    return this.templateVersions.get(templateType) || '1.0';
  }

  /**
   * Build thematic analysis prompt
   */
  buildThematicAnalysisPrompt(responses: any[], options: any = {}): string {
    const template = this.getTemplate('thematic-analysis-v1');
    if (!template) {
      throw new Error('Thematic analysis template not found');
    }

    const variables: PromptVariables = {
      responses: JSON.stringify(responses.map(r => r.answer || r)),
      responseCount: responses.length,
      questionText: options.questionText || 'Pytanie kwestionariuszowe',
      language: options.language || 'pl',
      minFrequency: options.minFrequency || 2,
    };

    return this.processTemplate(template.template, variables);
  }

  /**
   * Build clustering analysis prompt
   */
  buildClusteringPrompt(responses: any[], options: any = {}): string {
    const template = this.getTemplate('hierarchical-clustering-v1');
    if (!template) {
      throw new Error('Clustering template not found');
    }

    const variables: PromptVariables = {
      responses: JSON.stringify(responses.map(r => r.answer || r)),
      responseCount: responses.length,
      minClusterSize: options.minClusterSize || 3,
      hasEmbeddings: options.hasEmbeddings || false,
    };

    return this.processTemplate(template.template, variables);
  }

  /**
   * Build contradictions analysis prompt
   */
  buildContradictionsPrompt(responses: any[], options: any = {}): string {
    const template = this.getTemplate('contradiction-detection-v1');
    if (!template) {
      throw new Error('Contradictions template not found');
    }

    const variables: PromptVariables = {
      responses: JSON.stringify(responses),
      question1Text: options.question1Text || 'Pytanie 1',
      question2Text: options.question2Text || 'Pytanie 2',
      question1Id: options.question1Id || 'q1',
      question2Id: options.question2Id || 'q2',
    };

    return this.processTemplate(template.template, variables);
  }

  /**
   * Build insights extraction prompt
   */
  buildInsightsPrompt(responses: any[], options: any = {}): string {
    const template = this.getTemplate('insights-extraction-v1');
    if (!template) {
      throw new Error('Insights template not found');
    }

    const variables: PromptVariables = {
      section1Responses: JSON.stringify(options.section1Responses || []),
      section2Responses: JSON.stringify(options.section2Responses || []),
      section3Responses: JSON.stringify(options.section3Responses || []),
      section4Responses: JSON.stringify(options.section4Responses || []),
      workshopTheme: options.workshopTheme || 'Wspólnota mieszkaniowa',
      participantCount: options.participantCount || 0,
      duration: options.duration || 'nieokreślony',
    };

    return this.processTemplate(template.template, variables);
  }

  /**
   * Build sentiment analysis prompt
   */
  buildSentimentAnalysisPrompt(responses: any[], options: any = {}): string {
    const template = this.getTemplate('sentiment-analysis-v1');
    if (!template) {
      throw new Error('Sentiment analysis template not found');
    }

    const variables: PromptVariables = {
      responses: JSON.stringify(responses),
      questionText: options.questionText || 'Pytanie',
      responseCount: responses.length,
      language: options.language || 'pl',
      culturalContext: options.culturalContext || 'europejska',
      enableCulturalBias: options.enableCulturalBias || false,
    };

    let prompt = this.processTemplate(template.template, variables);

    // Add cultural bias mitigation if enabled
    if (options.enableCulturalBias) {
      prompt = this.addCulturalBiasInstructions(prompt, options.culturalContext, options.language);
    }

    return prompt;
  }

  /**
   * Build recommendations prompt
   */
  buildRecommendationsPrompt(responses: any[], options: any = {}): string {
    const template = this.getTemplate('smart-recommendations-v1');
    if (!template) {
      throw new Error('Recommendations template not found');
    }

    const variables: PromptVariables = {
      themesSummary: JSON.stringify(options.themesSummary || {}),
      clustersSummary: JSON.stringify(options.clustersSummary || {}),
      contradictionsSummary: JSON.stringify(
        options.contradictionsSummary || {},
      ),
      insightsSummary: JSON.stringify(options.insightsSummary || {}),
      communityType: options.communityType || 'Mieszkańcy',
      residentCount: options.residentCount || 0,
      budgetStatus: options.budgetStatus || 'nieokreślony',
      locationType: options.locationType || 'miejska',
    };

    return this.processTemplate(template.template, variables);
  }

  /**
   * Add cultural bias instructions to prompt
   */
  private addCulturalBiasInstructions(
    prompt: string,
    culturalContext: string = 'europejska',
    language: string = 'pl',
  ): string {
    const culturalInstructions = `
# INSTRUKCJE DOTYCZĄCE WSPÓŁCZESNOŚCI KULTUROWEJ

## KONTEKST KULTUROWY
Analiza jest prowadzona w kontekście kulturowym: ${culturalContext}
Język odpowiedzi: ${language}

## WSKAZÓWKI ANTYBIASOWE
1. Unikaj zakładania, że normy kulturowe zachodnie są uniwersalne
2. Bądź świadomy/a różnic kulturowych w wyrażaniu emocji i opinii
3. Nie interpretuj ciszy lub ograniczonych odpowiedzi jako braku zaangażowania
4. Uwzględnij kontekst historyczny i społeczny respondentów
5. Rozróżniaj między brakiem zgody a brakiem wiedzy
6. Uważaj na stereotypy kulturowe w interpretacji odpowiedzi

## JĘZYK I WYRAŻANIE
- W języku polskim emocje mogą być wyrażane bardziej powściągliwie
- Negatywne opinie mogą być formułowane bardziej pośrednio
- Entuzjazm może być manifestowany przez szczegółowe odpowiedzi zamiast wykrzykników
- Krytyka może być poprzedzona pozytywnymi uwagami

## ANALIZA
Biorąc pod uwagę powyższe wskazówki, przeprowadź analizę sentymentu z uwzględnieniem specyfiki kulturowej.
`;

    return `${prompt}\n\n${culturalInstructions}`;
  }

  /**
   * Process template with variables (basic variable substitution)
   */
  private processTemplate(
    template: string,
    variables: PromptVariables,
  ): string {
    let processed = template;

    // Simple variable substitution {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    processed = processed.replace(
      /{{#if\s+(\w+)}}(.*?){{\/if}}/gs,
      (match, varName, content) => {
        const value = variables[varName];
        return value ? content : '';
      },
    );

    return processed;
  }

  /**
   * Validate prompt variables against template requirements
   */
  validateVariables(
    templateId: string,
    variables: PromptVariables,
  ): {
    valid: boolean;
    missing: string[];
    extra: string[];
  } {
    const template = this.getTemplate(templateId);
    if (!template) {
      return {
        valid: false,
        missing: [],
        extra: Object.keys(variables),
      };
    }

    const providedVars = Object.keys(variables);
    const requiredVars = template.requiredVars;
    const optionalVars = template.optionalVars || [];

    const missing = requiredVars.filter(
      varName => !providedVars.includes(varName),
    );
    const extra = providedVars.filter(
      varName =>
        !requiredVars.includes(varName) && !optionalVars.includes(varName),
    );

    return {
      valid: missing.length === 0,
      missing,
      extra,
    };
  }

  /**
   * Get all templates for category
   */
  getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(
      template => template.category === category,
    );
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): {
    total: number;
    byCategory: Record<string, number>;
    byVersion: Record<string, number>;
    } {
    const templates = Array.from(this.templates.values());

    const byCategory = templates.reduce(
      (acc, template) => {
        acc[template.category] = (acc[template.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byVersion = templates.reduce(
      (acc, template) => {
        acc[template.version] = (acc[template.version] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: templates.length,
      byCategory,
      byVersion,
    };
  }

  /**
   * Create custom prompt
   */
  createCustomPrompt(
    name: string,
    template: string,
    requiredVars: string[],
    optionalVars: string[] = [],
    constraints: PromptTemplate['constraints'] = {},
  ): PromptTemplate {
    return {
      id: `custom-${Date.now()}`,
      name,
      version: '1.0',
      description: 'Custom user-generated prompt',
      category: 'analysis',
      template,
      requiredVars,
      optionalVars,
      constraints,
    };
  }
}

// Export singleton instance
export const promptTemplateService = new PromptTemplateService();
