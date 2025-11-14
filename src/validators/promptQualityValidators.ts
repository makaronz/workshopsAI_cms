/**
 * Quality Validators for Prompt Templates
 * Comprehensive validation system for prompt templates and generated outputs
 */

import {
  TemplateQualityMetrics,
  TemplateContext,
  TemplateVersion,
} from '../services/promptTemplateManager';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'structure' | 'content' | 'compliance' | 'performance';
  severity: 'error' | 'warning' | 'info';
  validator: (input: any, context?: any) => ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  score?: number;
  message: string;
  suggestions?: string[];
  details?: any;
}

export interface ValidationError {
  rule: string;
  category: string;
  severity: string;
  message: string;
  suggestions: string[];
  line?: number;
  position?: number;
}

export interface ValidationReport {
  overallScore: number;
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  metrics: {
    totalRules: number;
    passedRules: number;
    failedRules: number;
    criticalFailures: number;
  };
  recommendations: string[];
}

export interface ComplianceFramework {
  gdpr: {
    dataMinimization: boolean;
    consentVerification: boolean;
    anonymizationCompliance: boolean;
    dataSubjectRights: boolean;
  };
  ethics: {
    biasDetection: boolean;
    fairnessAssessment: boolean;
    transparencyRequirement: boolean;
    accountabilityMeasure: boolean;
  };
  security: {
    promptInjectionProtection: boolean;
    dataLeakagePrevention: boolean;
    accessControlValidation: boolean;
  };
}

/**
 * Prompt Quality Validator
 */
export class PromptQualityValidator {
  private rules: Map<string, ValidationRule> = new Map();
  private complianceFramework: ComplianceFramework;

  constructor() {
    this.initializeRules();
    this.complianceFramework = this.initializeComplianceFramework();
  }

  /**
   * Initialize all validation rules
   */
  private initializeRules(): void {
    // Structure Rules
    this.addRule({
      id: 'required_sections',
      name: 'Required Sections Present',
      description: 'Template must contain all required sections',
      category: 'structure',
      severity: 'error',
      validator: this.validateRequiredSections.bind(this),
    });

    this.addRule({
      id: 'json_structure',
      name: 'Valid JSON Structure',
      description: 'Template output must be valid JSON',
      category: 'structure',
      severity: 'error',
      validator: this.validateJsonStructure.bind(this),
    });

    this.addRule({
      id: 'variable_syntax',
      name: 'Variable Syntax Check',
      description: 'Template variables must use correct syntax',
      category: 'structure',
      severity: 'error',
      validator: this.validateVariableSyntax.bind(this),
    });

    this.addRule({
      id: 'conditional_blocks',
      name: 'Conditional Block Validation',
      description: 'Conditional blocks must be properly structured',
      category: 'structure',
      severity: 'warning',
      validator: this.validateConditionalBlocks.bind(this),
    });

    // Content Rules
    this.addRule({
      id: 'instruction_clarity',
      name: 'Instruction Clarity',
      description: 'Instructions must be clear and unambiguous',
      category: 'content',
      severity: 'warning',
      validator: this.validateInstructionClarity.bind(this),
    });

    this.addRule({
      id: 'cultural_adaptation',
      name: 'Cultural Adaptation',
      description: 'Template must be culturally adapted',
      category: 'content',
      severity: 'info',
      validator: this.validateCulturalAdaptation.bind(this),
    });

    this.addRule({
      id: 'example_quality',
      name: 'Example Quality',
      description: 'Examples must be relevant and illustrative',
      category: 'content',
      severity: 'warning',
      validator: this.validateExampleQuality.bind(this),
    });

    this.addRule({
      id: 'output_completeness',
      name: 'Output Completeness',
      description: 'Output specification must be complete',
      category: 'content',
      severity: 'error',
      validator: this.validateOutputCompleteness.bind(this),
    });

    // Compliance Rules
    this.addRule({
      id: 'gdpr_compliance',
      name: 'GDPR Compliance',
      description: 'Template must comply with GDPR requirements',
      category: 'compliance',
      severity: 'error',
      validator: this.validateGDPRCompliance.bind(this),
    });

    this.addRule({
      id: 'bias_prevention',
      name: 'Bias Prevention',
      description: 'Template must avoid biased language',
      category: 'compliance',
      severity: 'warning',
      validator: this.validateBiasPrevention.bind(this),
    });

    this.addRule({
      id: 'prompt_injection_protection',
      name: 'Prompt Injection Protection',
      description: 'Template must be protected against prompt injection',
      category: 'compliance',
      severity: 'error',
      validator: this.validatePromptInjectionProtection.bind(this),
    });

    this.addRule({
      id: 'ethical_guidelines',
      name: 'Ethical Guidelines',
      description: 'Template must follow ethical guidelines',
      category: 'compliance',
      severity: 'warning',
      validator: this.validateEthicalGuidelines.bind(this),
    });

    // Performance Rules
    this.addRule({
      id: 'token_efficiency',
      name: 'Token Efficiency',
      description: 'Template should be token-efficient',
      category: 'performance',
      severity: 'info',
      validator: this.validateTokenEfficiency.bind(this),
    });

    this.addRule({
      id: 'processing_time_estimate',
      name: 'Processing Time Estimate',
      description: 'Template should have reasonable processing time',
      category: 'performance',
      severity: 'info',
      validator: this.validateProcessingTimeEstimate.bind(this),
    });

    this.addRule({
      id: 'output_size_optimization',
      name: 'Output Size Optimization',
      description: 'Output should be appropriately sized',
      category: 'performance',
      severity: 'warning',
      validator: this.validateOutputSizeOptimization.bind(this),
    });
  }

  /**
   * Add a validation rule
   */
  public addRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a validation rule
   */
  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Validate template content
   */
  public validateTemplate(
    content: string,
    context: TemplateContext,
    template?: TemplateVersion,
  ): ValidationReport {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const info: ValidationError[] = [];

    let totalRules = 0;
    let passedRules = 0;
    let failedRules = 0;
    let criticalFailures = 0;

    // Run all validation rules
    for (const rule of this.rules.values()) {
      totalRules++;
      try {
        const result = rule.validator(content, { context, template });

        const validationError: ValidationError = {
          rule: rule.id,
          category: rule.category,
          severity: rule.severity,
          message: result.message,
          suggestions: result.suggestions || [],
          details: result.details,
        };

        if (result.passed) {
          passedRules++;
        } else {
          failedRules++;
          if (rule.severity === 'error') {
            criticalFailures++;
            errors.push(validationError);
          } else if (rule.severity === 'warning') {
            warnings.push(validationError);
          } else {
            info.push(validationError);
          }
        }
      } catch (error) {
        failedRules++;
        criticalFailures++;
        errors.push({
          rule: rule.id,
          category: rule.category,
          severity: 'error',
          message: `Validation rule failed: ${error instanceof Error ? error.message : String(error)}`,
          suggestions: ['Check rule implementation', 'Review input format'],
        });
      }
    }

    // Calculate overall score
    const overallScore = totalRules > 0 ? (passedRules / totalRules) * 100 : 0;
    const passed = criticalFailures === 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      errors,
      warnings,
      info,
    );

    return {
      overallScore,
      passed,
      errors,
      warnings,
      info,
      metrics: {
        totalRules,
        passedRules,
        failedRules,
        criticalFailures,
      },
      recommendations,
    };
  }

  /**
   * Validate generated LLM output
   */
  public validateOutput(
    output: any,
    expectedSchema?: any,
    context?: TemplateContext,
  ): ValidationReport {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const info: ValidationError[] = [];

    let passedRules = 0;
    let totalRules = 0;
    let criticalFailures = 0;

    // Validate JSON structure
    totalRules++;
    if (typeof output === 'object' && output !== null) {
      passedRules++;
    } else {
      criticalFailures++;
      errors.push({
        rule: 'output_json_structure',
        category: 'structure',
        severity: 'error',
        message: 'Output must be valid JSON object',
        suggestions: [
          'Ensure LLM returns JSON format',
          'Check response_format parameter',
        ],
      });
    }

    // Validate against expected schema
    if (expectedSchema) {
      totalRules++;
      const schemaValidation = this.validateAgainstSchema(
        output,
        expectedSchema,
      );
      if (schemaValidation.passed) {
        passedRules++;
      } else {
        criticalFailures++;
        errors.push({
          rule: 'output_schema_compliance',
          category: 'structure',
          severity: 'error',
          message: schemaValidation.message,
          suggestions: schemaValidation.suggestions,
        });
      }
    }

    // Check for PII leakage
    totalRules++;
    const piiCheck = this.checkForPIILeakage(JSON.stringify(output));
    if (piiCheck.passed) {
      passedRules++;
    } else {
      criticalFailures++;
      errors.push({
        rule: 'pii_leakage',
        category: 'compliance',
        severity: 'error',
        message: 'Output contains potential PII',
        suggestions: piiCheck.suggestions,
      });
    }

    // Check output quality
    totalRules++;
    const qualityCheck = this.validateOutputQuality(output, context);
    if (qualityCheck.passed) {
      passedRules++;
    } else {
      if (qualityCheck.score && qualityCheck.score < 50) {
        criticalFailures++;
        errors.push({
          rule: 'output_quality',
          category: 'content',
          severity: 'error',
          message: qualityCheck.message,
          suggestions: qualityCheck.suggestions,
        });
      } else {
        warnings.push({
          rule: 'output_quality',
          category: 'content',
          severity: 'warning',
          message: qualityCheck.message,
          suggestions: qualityCheck.suggestions,
        });
      }
    }

    const overallScore = totalRules > 0 ? (passedRules / totalRules) * 100 : 0;
    const passed = criticalFailures === 0;

    return {
      overallScore,
      passed,
      errors,
      warnings,
      info,
      metrics: {
        totalRules,
        passedRules,
        failedRules: totalRules - passedRules,
        criticalFailures,
      },
      recommendations: this.generateOutputRecommendations(errors, warnings),
    };
  }

  // Validation Rule Implementations

  private validateRequiredSections(
    content: string,
    context: any,
  ): ValidationResult {
    const requiredSections = [
      'ZADANIE',
      'INSTRUKCJE',
      'FORMAT',
      'WSKAZÓWKI',
    ] || ['TASK', 'INSTRUCTIONS', 'FORMAT', 'GUIDELINES'];
    const missingSections = requiredSections.filter(
      section => !content.includes(section),
    );

    if (missingSections.length === 0) {
      return {
        passed: true,
        score: 100,
        message: 'All required sections are present',
      };
    }

    return {
      passed: false,
      score: 50,
      message: `Missing required sections: ${missingSections.join(', ')}`,
      suggestions: [
        `Add missing sections: ${missingSections.join(', ')}`,
        'Use standard section headers',
        'Follow template structure guidelines',
      ],
    };
  }

  private validateJsonStructure(
    content: string,
    context: any,
  ): ValidationResult {
    try {
      // Check if content contains JSON specification
      if (content.includes('```json') || content.includes('"format"')) {
        return {
          passed: true,
          score: 100,
          message: 'JSON structure specification found',
        };
      }

      // Try to find and validate JSON output example
      const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        JSON.parse(jsonMatch[1]); // This will throw if invalid
        return {
          passed: true,
          score: 100,
          message: 'JSON output example is valid',
        };
      }

      return {
        passed: false,
        score: 0,
        message: 'No JSON output specification found',
        suggestions: [
          'Add JSON output format specification',
          'Include JSON example in template',
          'Use response_format: json_object in API call',
        ],
      };
    } catch (error) {
      return {
        passed: false,
        score: 0,
        message: 'Invalid JSON structure in template',
        suggestions: [
          'Fix JSON syntax errors',
          'Validate JSON format',
          'Use JSON linting tools',
        ],
      };
    }
  }

  private validateVariableSyntax(
    content: string,
    context: any,
  ): ValidationResult {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables = content.match(variableRegex) || [];

    const invalidVariables: string[] = [];
    const validVariablePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

    for (const variable of variables) {
      const varName = variable.slice(2, -2).trim();

      // Check conditional and loop syntax
      if (
        varName.startsWith('#if ') ||
        varName.startsWith('#each ') ||
        varName.startsWith('/if') ||
        varName.startsWith('/each')
      ) {
        continue; // These are control structures
      }

      // Check for proper variable name
      if (!validVariablePattern.test(varName)) {
        invalidVariables.push(variable);
      }
    }

    if (invalidVariables.length === 0) {
      return {
        passed: true,
        score: 100,
        message: `All ${variables.length} variables use correct syntax`,
      };
    }

    return {
      passed: false,
      score: 50,
      message: `Invalid variable syntax found: ${invalidVariables.join(', ')}`,
      suggestions: [
        'Use alphanumeric variable names with underscores',
        'Start variable names with letters',
        'Avoid special characters in variable names',
      ],
    };
  }

  private validateConditionalBlocks(
    content: string,
    context: any,
  ): ValidationResult {
    const ifRegex = /\{\{#if\s+(\w+)\}\}/g;
    const eachRegex = /\{\{#each\s+(\w+)\}\}/g;

    const ifBlocks = (content.match(ifRegex) || []).length;
    const eachBlocks = (content.match(eachRegex) || []).length;
    const closingBlocks = (content.match(/\{\{\/(if|each)\}\}/g) || []).length;

    const expectedClosings = ifBlocks + eachBlocks;

    if (closingBlocks === expectedClosings) {
      return {
        passed: true,
        score: 100,
        message: 'All conditional blocks are properly closed',
      };
    }

    return {
      passed: false,
      score: 50,
      message: `Mismatched conditional blocks: ${expectedClosings} openings, ${closingBlocks} closings`,
      suggestions: [
        'Ensure all {{#if}} blocks have corresponding {{/if}}',
        'Ensure all {{#each}} blocks have corresponding {{/each}}',
        'Check for nested block structures',
      ],
    };
  }

  private validateInstructionClarity(
    content: string,
    context: any,
  ): ValidationResult {
    // Simple heuristic based on instruction clarity indicators
    const clarityIndicators = [
      'kroki',
      'krok',
      'instrukcja',
      'zrób',
      'wykonaj', // Polish
      'step',
      'instruction',
      'do',
      'execute',
      'follow', // English
      '1.',
      '2.',
      '3.',
      '●',
      '■',
      '→', // Numbered/bullet lists
    ];

    const foundIndicators = clarityIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase()),
    ).length;

    const score = Math.min(100, foundIndicators * 15);
    const passed = score >= 60;

    return {
      passed,
      score,
      message: passed
        ? `Instructions appear clear with ${foundIndicators} clarity indicators`
        : `Instructions may be unclear (only ${foundIndicators} clarity indicators)`,
      suggestions: passed
        ? []
        : [
          'Add numbered steps for complex processes',
          'Use clear action verbs',
          'Include bullet points for lists',
          'Provide examples for complex instructions',
        ],
    };
  }

  private validateCulturalAdaptation(
    content: string,
    context: any,
  ): ValidationResult {
    const { context: templateContext } = context;
    const language = templateContext?.language || 'en';

    const culturalMarkers = {
      pl: ['polski', 'kontekst kulturowy', 'wartości polskie', 'społeczeństwo'],
      en: ['cultural context', 'english', 'social context', 'community values'],
    };

    const markers =
      culturalMarkers[language as keyof typeof culturalMarkers] || [];
    const foundMarkers = markers.filter(marker =>
      content.toLowerCase().includes(marker.toLowerCase()),
    ).length;

    const score = Math.min(100, foundMarkers * 25);
    const passed = score >= 50;

    return {
      passed,
      score,
      message: passed
        ? `Template shows cultural adaptation with ${foundMarkers} markers`
        : `Template may lack cultural adaptation (${foundMarkers} markers found)`,
      suggestions: passed
        ? []
        : [
          'Add cultural context references',
          'Include language-specific examples',
          'Consider local values and norms',
          'Adapt communication style to local preferences',
        ],
    };
  }

  private validateExampleQuality(
    content: string,
    context: any,
  ): ValidationResult {
    // Look for example sections and evaluate their quality
    const exampleRegex = /przykład|example|np\.|e\.g\./gi;
    const examples = content.match(exampleRegex) || [];

    if (examples.length === 0) {
      return {
        passed: true,
        score: 80,
        message: 'No examples found (not required for all templates)',
        suggestions: [
          'Consider adding examples to improve clarity',
          'Use examples for complex instructions',
        ],
      };
    }

    // Check if examples are specific enough
    const specificExamples = content.match(/"[^"]+"/g) || [];
    const specificityRatio =
      specificExamples.length / Math.max(examples.length, 1);
    const score = Math.min(100, specificityRatio * 100);
    const passed = score >= 60;

    return {
      passed,
      score,
      message: passed
        ? `Examples appear specific (${specificExamples.length} specific examples)`
        : `Examples may be too generic (${specificExamples.length} specific examples for ${examples.length} references)`,
      suggestions: passed
        ? []
        : [
          'Provide concrete examples with quotes',
          'Use realistic data in examples',
          'Include both positive and negative examples',
          'Make examples relevant to the task',
        ],
    };
  }

  private validateOutputCompleteness(
    content: string,
    context: any,
  ): ValidationResult {
    // Check if output specification is complete
    const requiredOutputFields = ['format', 'struktura', 'wymagane pola'] || [
      'format',
      'structure',
      'required fields',
    ];

    const foundFields = requiredOutputFields.filter(field =>
      content.toLowerCase().includes(field.toLowerCase()),
    ).length;

    const score = (foundFields / requiredOutputFields.length) * 100;
    const passed = score >= 80;

    return {
      passed,
      score,
      message: passed
        ? 'Output specification appears complete'
        : `Output specification may be incomplete (${foundFields}/${requiredOutputFields.length} indicators found)`,
      suggestions: passed
        ? []
        : [
          'Specify exact output format',
          'Define required output fields',
          'Include data types for each field',
          'Provide example output structure',
        ],
    };
  }

  private validateGDPRCompliance(
    content: string,
    context: any,
  ): ValidationResult {
    const gdprIndicators = [
      'anonim',
      'dane osobowe',
      'gdpr',
      'prywatność',
      'zgoda',
      'anonymous',
      'personal data',
      'privacy',
      'consent',
      'pii',
    ];

    const foundIndicators = gdprIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase()),
    ).length;

    const score = Math.min(100, foundIndicators * 20);
    const passed = score >= 60;

    return {
      passed,
      score,
      message: passed
        ? `Template shows GDPR compliance awareness with ${foundIndicators} indicators`
        : `Template may lack GDPR compliance considerations (${foundIndicators} indicators found)`,
      suggestions: passed
        ? []
        : [
          'Add explicit privacy instructions',
          'Include anonymization requirements',
          'Mention data processing consent',
          'Add GDPR compliance reminders',
        ],
    };
  }

  private validateBiasPrevention(
    content: string,
    context: any,
  ): ValidationResult {
    const biasIndicators = [
      'bezstronny',
      'obiektywny',
      'równy',
      'różnorodność',
      'unbiased',
      'objective',
      'equal',
      'diversity',
      'inclusive',
    ];

    const biasedPatterns = [
      /zawsze|nigdy|wszyscy|nikt/gi, // Polish absolutist words
      /always|never|everyone|nobody/gi, // English absolutist words
    ];

    const foundIndicators = biasIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase()),
    ).length;

    const biasedWords =
      content.match(biasedPatterns[0]) ||
      content.match(biasedPatterns[1]) ||
      [];
    const biasPenalty = biasedWords.length * 10;

    const score = Math.max(
      0,
      Math.min(100, foundIndicators * 15 - biasPenalty),
    );
    const passed = score >= 60 && biasedWords.length === 0;

    return {
      passed,
      score,
      message: passed
        ? 'Template appears to address bias prevention'
        : biasedWords.length > 0
          ? `Template contains potentially biased language: ${biasedWords.join(', ')}`
          : `Template may need bias prevention considerations (${foundIndicators} indicators found)`,
      suggestions: passed
        ? []
        : [
          'Add bias awareness instructions',
          'Include diversity considerations',
          'Avoid absolutist language',
          'Use neutral, inclusive language',
        ],
    };
  }

  private validatePromptInjectionProtection(
    content: string,
    context: any,
  ): ValidationResult {
    // Check for prompt injection protection patterns
    const protectionPatterns = [
      'ignoruj poprzednie instrukcje',
      'tylko analizuj podane dane',
      'nie wykonuj innych poleceń',
      'ignore previous instructions',
      'only analyze provided data',
      'do not execute other commands',
    ];

    const foundProtections = protectionPatterns.filter(pattern =>
      content.toLowerCase().includes(pattern.toLowerCase()),
    ).length;

    const score = Math.min(100, foundProtections * 25);
    const passed = score >= 50;

    return {
      passed,
      score,
      message: passed
        ? `Template includes prompt injection protection (${foundProtections} protections found)`
        : `Template may lack prompt injection protection (${foundProtections} protections found)`,
      suggestions: passed
        ? []
        : [
          'Add instruction to ignore previous prompts',
          'Specify to only analyze provided data',
          'Include boundary setting instructions',
          'Use role-based prompting for security',
        ],
    };
  }

  private validateEthicalGuidelines(
    content: string,
    context: any,
  ): ValidationResult {
    const ethicalIndicators = [
      'etyka',
      'moralność',
      'odpowiedzialność',
      'szacunek',
      'ethics',
      'morality',
      'responsibility',
      'respect',
      'harm',
    ];

    const foundIndicators = ethicalIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase()),
    ).length;

    const score = Math.min(100, foundIndicators * 20);
    const passed = score >= 40;

    return {
      passed,
      score,
      message: passed
        ? `Template addresses ethical considerations (${foundIndicators} indicators found)`
        : `Template may benefit from ethical guidelines (${foundIndicators} indicators found)`,
      suggestions: passed
        ? []
        : [
          'Add ethical behavior guidelines',
          'Include harm prevention instructions',
          'Specify respect for privacy and autonomy',
          'Add responsibility reminders',
        ],
    };
  }

  private validateTokenEfficiency(
    content: string,
    context: any,
  ): ValidationResult {
    const tokenCount = this.estimateTokens(content);
    const efficiencyThreshold = 4000; // Target maximum tokens

    const score = Math.max(
      0,
      Math.min(100, (1 - tokenCount / (efficiencyThreshold * 2)) * 100),
    );
    const passed = tokenCount <= efficiencyThreshold;

    return {
      passed,
      score,
      message: passed
        ? `Template is token-efficient (${tokenCount} tokens)`
        : `Template may be too verbose (${tokenCount} tokens, recommended: ${efficiencyThreshold})`,
      suggestions: passed
        ? []
        : [
          'Remove redundant instructions',
          'Consolidate similar points',
          'Use more concise language',
          'Consider breaking into multiple templates',
        ],
    };
  }

  private validateProcessingTimeEstimate(
    content: string,
    context: any,
  ): ValidationResult {
    const tokenCount = this.estimateTokens(content);
    // Rough processing time estimate: 100ms per 1000 tokens
    const estimatedTime = (tokenCount / 1000) * 100;
    const maxAcceptableTime = 5000; // 5 seconds

    const score = Math.max(
      0,
      Math.min(100, (1 - estimatedTime / maxAcceptableTime) * 100),
    );
    const passed = estimatedTime <= maxAcceptableTime;

    return {
      passed,
      score,
      message: passed
        ? `Estimated processing time is acceptable (~${estimatedTime}ms)`
        : `Template may be slow to process (~${estimatedTime}ms, recommended: <${maxAcceptableTime}ms)`,
      suggestions: passed
        ? []
        : [
          'Reduce template complexity',
          'Optimize instruction structure',
          'Consider preprocessing heavy analysis',
          'Use more efficient prompting strategies',
        ],
    };
  }

  private validateOutputSizeOptimization(
    content: string,
    context: any,
  ): ValidationResult {
    // Look for output size specifications
    const sizeIndicators = [
      'maksymalnie',
      'limit',
      ' nie więcej niż',
      'do',
      'maximum',
      'limit',
      'no more than',
      'up to',
    ];

    const foundIndicators = sizeIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase()),
    ).length;

    const score = Math.min(100, foundIndicators * 25);
    const passed = score >= 50;

    return {
      passed,
      score,
      message: passed
        ? `Template includes output size constraints (${foundIndicators} indicators found)`
        : `Template may benefit from output size constraints (${foundIndicators} indicators found)`,
      suggestions: passed
        ? []
        : [
          'Add output size limits',
          'Specify maximum response length',
          'Include token usage guidelines',
          'Set response field constraints',
        ],
    };
  }

  private validateAgainstSchema(output: any, schema: any): ValidationResult {
    // Basic schema validation
    try {
      // This would typically use a JSON schema validator
      // For now, implement basic checks
      if (typeof output !== 'object' || output === null) {
        return {
          passed: false,
          message: 'Output is not an object',
          suggestions: ['Ensure output is a valid JSON object'],
        };
      }

      // Check required properties if schema specifies them
      if (schema.required && Array.isArray(schema.required)) {
        const missingProps = schema.required.filter(
          (prop: string) => !(prop in output),
        );
        if (missingProps.length > 0) {
          return {
            passed: false,
            message: `Missing required properties: ${missingProps.join(', ')}`,
            suggestions: [`Ensure output includes: ${missingProps.join(', ')}`],
          };
        }
      }

      return {
        passed: true,
        message: 'Output matches schema requirements',
      };
    } catch (error) {
      return {
        passed: false,
        message: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestions: ['Check output structure', 'Verify schema definition'],
      };
    }
  }

  private checkForPIILeakage(content: string): ValidationResult {
    const piiPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{11}\b/g, // PESEL
      /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
      /\b\d{2}\/\d{2}\/\d{4}\b/g, // Date
    ];

    const foundPII: string[] = [];
    for (const pattern of piiPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        foundPII.push(...matches);
      }
    }

    const uniquePII = [...new Set(foundPII)];

    if (uniquePII.length === 0) {
      return {
        passed: true,
        message: 'No PII detected in output',
      };
    }

    return {
      passed: false,
      message: `PII detected in output: ${uniquePII.length} instances`,
      suggestions: [
        'Implement stronger anonymization',
        'Add PII detection in post-processing',
        'Review data handling procedures',
        'Ensure proper data redaction',
      ],
    };
  }

  private validateOutputQuality(
    output: any,
    context?: TemplateContext,
  ): ValidationResult {
    if (!output || typeof output !== 'object') {
      return {
        passed: false,
        score: 0,
        message: 'Output is not a valid object',
        suggestions: [
          'Ensure LLM returns structured output',
          'Check response parsing',
        ],
      };
    }

    // Check output completeness
    const outputKeys = Object.keys(output);
    const expectedKeys = ['results', 'summary', 'analysis'];
    const completenessScore =
      (expectedKeys.filter(key => outputKeys.includes(key)).length /
        expectedKeys.length) *
      50;

    // Check output depth
    const depthScore = Math.min(50, outputKeys.length * 5);

    const totalScore = completenessScore + depthScore;
    const passed = totalScore >= 60;

    return {
      passed,
      score: totalScore,
      message: passed
        ? `Output quality is acceptable (score: ${totalScore})`
        : `Output quality needs improvement (score: ${totalScore})`,
      suggestions: passed
        ? []
        : [
          'Ensure output includes expected sections',
          'Add more detailed analysis results',
          'Include confidence scores and metadata',
          'Provide comprehensive summaries',
        ],
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private generateRecommendations(
    errors: ValidationError[],
    warnings: ValidationError[],
    info: ValidationError[],
  ): string[] {
    const recommendations = new Set<string>();

    // Add recommendations based on error categories
    const errorCategories = [...new Set(errors.map(e => e.category))];
    const warningCategories = [...new Set(warnings.map(e => e.category))];

    if (errorCategories.includes('structure')) {
      recommendations.add(
        'Review template structure and fix critical formatting issues',
      );
    }
    if (errorCategories.includes('compliance')) {
      recommendations.add('Address compliance requirements immediately');
    }
    if (errorCategories.includes('content')) {
      recommendations.add('Improve content quality and completeness');
    }

    if (warningCategories.includes('content')) {
      recommendations.add('Consider enhancing content for better results');
    }
    if (warningCategories.includes('performance')) {
      recommendations.add('Optimize template for better performance');
    }

    return Array.from(recommendations);
  }

  private generateOutputRecommendations(
    errors: ValidationError[],
    warnings: ValidationError[],
  ): string[] {
    const recommendations = new Set<string>();

    if (errors.some(e => e.rule === 'pii_leakage')) {
      recommendations.add('Implement stronger PII detection and redaction');
    }
    if (errors.some(e => e.rule === 'output_schema_compliance')) {
      recommendations.add('Fix output schema validation issues');
    }
    if (warnings.some(e => e.rule === 'output_quality')) {
      recommendations.add('Improve output quality through better prompting');
    }

    return Array.from(recommendations);
  }

  private initializeComplianceFramework(): ComplianceFramework {
    return {
      gdpr: {
        dataMinimization: true,
        consentVerification: true,
        anonymizationCompliance: true,
        dataSubjectRights: true,
      },
      ethics: {
        biasDetection: true,
        fairnessAssessment: true,
        transparencyRequirement: true,
        accountabilityMeasure: true,
      },
      security: {
        promptInjectionProtection: true,
        dataLeakagePrevention: true,
        accessControlValidation: true,
      },
    };
  }

  /**
   * Get compliance framework
   */
  public getComplianceFramework(): ComplianceFramework {
    return this.complianceFramework;
  }

  /**
   * Update compliance framework
   */
  public updateComplianceFramework(
    updates: Partial<ComplianceFramework>,
  ): void {
    this.complianceFramework = {
      ...this.complianceFramework,
      ...updates,
    };
  }

  /**
   * Get all validation rules
   */
  public getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get validation rules by category
   */
  public getRulesByCategory(category: string): ValidationRule[] {
    return Array.from(this.rules.values()).filter(
      rule => rule.category === category,
    );
  }
}

// Export singleton instance
export const promptQualityValidator = new PromptQualityValidator();
