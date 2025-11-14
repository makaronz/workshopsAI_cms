import * as pdfParse from 'pdf-parse';
import { fileTypeFromBuffer } from 'file-type';
import DOMPurify from 'isomorphic-dompurify';
import crypto from 'crypto';

export interface ParsedQuestion {
  id: string;
  order: number;
  label: string;
  text: {
    pl: string;
    en?: string;
  };
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'scale'
    | 'single_choice'
    | 'multiple_choice';
  required: boolean;
  validation?: {
    min_length?: number;
    max_length?: number;
    min_value?: number;
    max_value?: number;
    pattern?: string;
  };
  help_text?: {
    pl?: string;
    en?: string;
  };
  options?: Array<{
    value: string;
    label: { pl: string; en?: string };
  }>;
}

export interface ParsedSection {
  id: string;
  order: number;
  title: {
    pl: string;
    en?: string;
  };
  description?: {
    pl: string;
    en?: string;
  };
  icon?: string;
  questions: ParsedQuestion[];
}

export interface ParsedTemplate {
  template_id: string;
  title: {
    pl: string;
    en?: string;
  };
  instructions?: {
    pl: string;
    en?: string;
  };
  version: string;
  language: string;
  category: string;
  description?: {
    pl: string;
    en?: string;
  };
  estimated_time_minutes: number;
  settings: {
    anonymous: boolean;
    require_consent: boolean;
    max_responses: number | null;
    close_after_workshop: boolean;
    show_all_questions: boolean;
    allow_edit: boolean;
    question_style: 'first_person_plural' | 'third_person';
    auto_save_interval_seconds: number;
  };
  sections: ParsedSection[];
  metadata: {
    total_questions: number;
    total_sections: number;
    created_by: string;
    created_at: string;
    last_updated: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    target_audience: string[];
    source_file_hash: string;
  };
}

export interface PDFTemplateParseOptions {
  language?: 'pl' | 'en' | 'both';
  autoDetectQuestions?: boolean;
  questionPatterns?: RegExp[];
  sectionPatterns?: RegExp[];
  maxFileSize?: number; // in bytes
}

export class PDFTemplateParser {
  private readonly DEFAULT_QUESTION_PATTERNS = [
    // Polish patterns
    /^\d+\.\s*(.+)[\?\!]?$/m, // "1. Question text?"
    /^[A-ZĄĆĘŁŃÓŚŹŻ][^.?!]*[?!]$/, // Capitalized question ending with ?
    /^Co\s+(?:jesteśmy|będziemy|mamy|potrzebujemy)/, // "Co jest...", "Co będziemy..."
    /^Jak\s+(?:wygląda|będziemy|mamy|rozwiązujemy)/, // "Jak wygląda...", "Jak będziemy..."
    /^Dlaczego\s+(?:istniejemy|mamy|wybraliśmy)/, // "Dlaczego istniejemy..."
    /^Czy\s+(?:mamy|będziemy|potrzebujemy)/, // "Czy mamy...", "Czy będziemy..."
    // English patterns
    /^\d+\.\s*(.+)[\?\!]?$/m, // "1. Question text?"
    /^What\s+(?:is|are|will|do)/, // "What is...", "What will..."
    /^How\s+(?:do|does|will|would)/, // "How do...", "How will..."
    /^Why\s+(?:do|does|did|will)/, // "Why do...", "Why will..."
    /^Where\s+(?:do|does|did|will)/, // "Where do...", "Where will..."
    /^When\s+(?:do|does|did|will)/, // "When do...", "When will..."
  ];

  private readonly DEFAULT_SECTION_PATTERNS = [
    // Polish patterns
    /^\d+\.\s*[A-ZĄĆĘŁŃÓŚŹŻ\s\/]+$/m, // "1. SEKCJA / PODSEKCJA"
    /^[A-ZĄĆĘŁŃÓŚŹŻ\s]+$/, // ALL CAPS section titles
    /^Sekcja\s+\d+:\s*.+$/i, // "Sekcja 1: Title"
    // English patterns
    /^\d+\.\s*[A-Z\s\/]+$/m, // "1. SECTION / SUBSECTION"
    /^[A-Z\s]+$/, // ALL CAPS section titles
    /^Section\s+\d+:\s*.+$/i, // "Section 1: Title"
  ];

  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  async parsePDF(
    pdfBuffer: Buffer,
    options: PDFTemplateParseOptions = {},
  ): Promise<ParsedTemplate> {
    // Validate file size
    const maxFileSize = options.maxFileSize || this.MAX_FILE_SIZE;
    if (pdfBuffer.length > maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${maxFileSize} bytes`,
      );
    }

    // Verify it's actually a PDF
    const fileType = await fileTypeFromBuffer(pdfBuffer);
    if (!fileType || fileType.mime !== 'application/pdf') {
      throw new Error('Invalid file type. Expected PDF.');
    }

    // Parse PDF content
    const pdfData = await pdfParse(pdfBuffer);
    const text = DOMPurify.sanitize(pdfData.text);

    // Generate file hash for metadata
    const fileHash = crypto
      .createHash('sha256')
      .update(pdfBuffer)
      .digest('hex');

    // Extract template information
    const template = this.extractTemplateFromText(text, options);

    // Add metadata
    template.metadata = {
      ...template.metadata,
      source_file_hash: fileHash,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    return template;
  }

  private extractTemplateFromText(
    text: string,
    options: PDFTemplateParseOptions,
  ): ParsedTemplate {
    const language = options.language || 'both';
    const autoDetect = options.autoDetectQuestions !== false;
    const questionPatterns =
      options.questionPatterns || this.DEFAULT_QUESTION_PATTERNS;
    const sectionPatterns =
      options.sectionPatterns || this.DEFAULT_SECTION_PATTERNS;

    // Split text into lines and clean them
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Detect sections
    const sections = this.detectSections(lines, sectionPatterns, language);

    // Detect questions within sections
    const sectionsWithQuestions = this.detectQuestions(
      sections,
      lines,
      questionPatterns,
      language,
      autoDetect,
    );

    // Generate template metadata
    const totalQuestions = sectionsWithQuestions.reduce(
      (sum, section) => sum + section.questions.length,
      0,
    );

    // Create template object
    const template: ParsedTemplate = {
      template_id: this.generateTemplateId(text),
      title: this.extractTitle(lines) || {
        pl: 'Kwestionariusz',
        en: 'Questionnaire',
      },
      instructions: this.extractInstructions(lines),
      version: '1.0.0',
      language: language === 'both' ? 'pl' : language,
      category: 'general',
      description: this.extractDescription(lines),
      estimated_time_minutes: Math.max(15, Math.ceil(totalQuestions * 1.5)),
      settings: {
        anonymous: false,
        require_consent: true,
        max_responses: null,
        close_after_workshop: false,
        show_all_questions: true,
        allow_edit: true,
        question_style: 'first_person_plural',
        auto_save_interval_seconds: 30,
      },
      sections: sectionsWithQuestions,
      metadata: {
        total_questions,
        total_sections: sectionsWithQuestions.length,
        created_by: 'pdf_import',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        tags: this.extractTags(lines),
        difficulty: 'beginner',
        target_audience: ['general'],
        source_file_hash: '', // Will be set in parsePDF
      },
    };

    return template;
  }

  private detectSections(
    lines: string[],
    patterns: RegExp[],
    language: string,
  ): Array<{
    order: number;
    title: { pl: string; en?: string };
    startIndex: number;
  }> {
    const sections: Array<{
      order: number;
      title: { pl: string; en?: string };
      startIndex: number;
    }> = [];

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const sectionTitle = match[1] || line;
          sections.push({
            order: sections.length + 1,
            title: this.extractBilingualText(sectionTitle, language),
            startIndex: index,
          });
          break; // Only match one pattern per line
        }
      }
    });

    // If no sections detected, create one default section
    if (sections.length === 0) {
      sections.push({
        order: 1,
        title: { pl: 'Główne pytania', en: 'Main Questions' },
        startIndex: 0,
      });
    }

    return sections;
  }

  private detectQuestions(
    sections: Array<{
      order: number;
      title: { pl: string; en?: string };
      startIndex: number;
    }>,
    lines: string[],
    patterns: RegExp[],
    language: string,
    autoDetect: boolean,
  ): ParsedSection[] {
    const result: ParsedSection[] = [];

    sections.forEach((section, sectionIndex) => {
      const nextSectionIndex =
        sectionIndex + 1 < sections.length
          ? sections[sectionIndex + 1].startIndex
          : lines.length;
      const sectionLines = lines.slice(
        section.startIndex + 1,
        nextSectionIndex,
      );

      const questions: ParsedQuestion[] = [];

      if (autoDetect) {
        // Auto-detect questions using patterns
        sectionLines.forEach((line, lineIndex) => {
          for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
              const questionText = match[1] || line;
              questions.push({
                id: this.generateQuestionId(
                  questionText,
                  sectionIndex,
                  questions.length,
                ),
                order: questions.length + 1,
                label: this.extractLabel(questionText),
                text: this.extractBilingualText(questionText, language),
                type: this.inferQuestionType(questionText),
                required: false,
                validation: this.inferValidation(questionText),
                help_text: this.extractHelpText(questionText),
              });
              break; // Only match one pattern per line
            }
          }
        });
      }

      // Create section object
      result.push({
        id: this.generateSectionId(
          section.title.pl || section.title.en || '',
          section.order,
        ),
        order: section.order,
        title: section.title,
        icon: this.inferSectionIcon(section.title.pl || section.title.en || ''),
        questions,
      });
    });

    return result;
  }

  private extractBilingualText(
    text: string,
    language: string,
  ): { pl: string; en?: string } {
    if (language === 'both') {
      // Try to detect if text contains both Polish and English
      const hasPolish = /[ąćęłńóśźż]/i.test(text);
      const hasEnglish = /[a-z]/i.test(text) && !hasPolish;

      if (hasPolish) {
        return { pl: text };
      } else if (hasEnglish) {
        return { pl: text, en: text }; // Use as both for now
      }
    }

    return language === 'en' ? { pl: '', en: text } : { pl: text };
  }

  private extractTitle(lines: string[]): { pl: string; en?: string } | null {
    // Look for title patterns in first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line.length > 10 && line.length < 100 && !line.match(/^\d+\./)) {
        const hasPolish = /[ąćęłńóśźż]/i.test(line);
        const hasEnglish = /[a-z]/i.test(line) && !hasPolish;

        if (hasPolish || hasEnglish) {
          return this.extractBilingualText(line, hasPolish ? 'pl' : 'en');
        }
      }
    }
    return null;
  }

  private extractInstructions(
    lines: string[],
  ): { pl: string; en?: string } | undefined {
    // Look for instruction-like text
    const instructionPatterns = [
      /^(Wypełnij|Proszę|Uzupełnij)/i,
      /^(Please|Fill|Complete)/i,
      /^(Pamiętaj|Zwróć uwagę)/i,
      /^(Remember|Note)/i,
    ];

    for (const line of lines) {
      for (const pattern of instructionPatterns) {
        if (pattern.test(line)) {
          return this.extractBilingualText(line, 'both');
        }
      }
    }

    return undefined;
  }

  private extractDescription(
    lines: string[],
  ): { pl: string; en?: string } | undefined {
    // Look for description-like text (non-questions, non-sections)
    const descriptionLines: string[] = [];
    let inDescription = false;

    for (const line of lines) {
      if (
        line.length > 20 &&
        !line.match(/^\d+\./) &&
        !line.match(/^[A-ZĄĆĘŁŃÓŚŹŻ\s\/]+$/)
      ) {
        inDescription = true;
        descriptionLines.push(line);
      } else if (inDescription && line.match(/^\d+\./)) {
        break; // Stop when we hit first question
      }
    }

    if (descriptionLines.length > 0) {
      const description = descriptionLines.slice(0, 3).join(' '); // First 3 lines
      return this.extractBilingualText(description, 'both');
    }

    return undefined;
  }

  private extractTags(lines: string[]): string[] {
    const tags = new Set<string>();

    // Common Polish and English tags from questionnaire content
    const tagKeywords = [
      'wspólnota',
      'mieszkalnictwo',
      'przestrzeń',
      'relacje',
      'organizacja',
      'community',
      'housing',
      'space',
      'relationships',
      'organization',
      'wizja',
      'manifest',
      'sytuacja',
      'planowanie',
      'rozwój',
      'vision',
      'manifest',
      'situation',
      'planning',
      'development',
    ];

    const fullText = lines.join(' ').toLowerCase();

    tagKeywords.forEach(keyword => {
      if (fullText.includes(keyword.toLowerCase())) {
        tags.add(keyword);
      }
    });

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  private extractLabel(text: string): string {
    // Extract a short label from longer question text
    const words = text.split(' ').slice(0, 5).join(' ');
    return words.length < text.length ? `${words}...` : words;
  }

  private extractHelpText(
    text: string,
  ): { pl?: string; en?: string } | undefined {
    // Look for help text in parentheses or after "np.", "e.g.", etc.
    const helpPatterns = [
      /\(([^)]+)\)/,
      /np\.\s*([^,.!?]+)/i,
      /e\.g\.\s*([^,.!?]+)/i,
      /na przykład\s*([^,.!?]+)/i,
      /for example\s*([^,.!?]+)/i,
    ];

    for (const pattern of helpPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.extractBilingualText(match[1].trim(), 'both');
      }
    }

    return undefined;
  }

  private inferQuestionType(text: string): ParsedQuestion['type'] {
    const lowerText = text.toLowerCase();

    // Scale questions
    if (lowerText.match(/(skala|ocen|od 1 do|od 0 do|rate|scale|1-10|0-10)/)) {
      return 'scale';
    }

    // Number questions
    if (lowerText.match(/(ile|liczbę|wiek|numer|how many|number|age|count)/)) {
      return 'number';
    }

    // Single choice questions
    if (lowerText.match(/(który|która|czy|which|whether|choose|select)/)) {
      return 'single_choice';
    }

    // Multiple choice questions
    if (
      lowerText.match(
        /(wszystkie|wymień|wszystkie które|list all|all that apply)/,
      )
    ) {
      return 'multiple_choice';
    }

    // Short text for simple questions
    if (
      lowerText.length < 50 ||
      lowerText.match(/(imię|nazwisko|email|phone|name|email|phone)/)
    ) {
      return 'text';
    }

    // Default to textarea for longer, more complex questions
    return 'textarea';
  }

  private inferValidation(text: string): ParsedQuestion['validation'] {
    const validation: ParsedQuestion['validation'] = {};
    const lowerText = text.toLowerCase();

    // Length constraints
    const shortAnswer = lowerText.match(/(krótko|zwięźle|short|brief)/);
    const longAnswer = lowerText.match(/(szczegółowo|opisz|describe|detailed)/);

    if (shortAnswer) {
      validation.max_length = 200;
    } else if (longAnswer) {
      validation.min_length = 10;
      validation.max_length = 1000;
    } else {
      validation.min_length = 5;
      validation.max_length = 500;
    }

    // Number constraints
    if (lowerText.match(/(wiek|age)/)) {
      validation.min_value = 0;
      validation.max_value = 120;
    }

    if (lowerText.match(/(ocena|rating|skala|scale)/)) {
      validation.min_value = 1;
      validation.max_value = 10;
    }

    return validation;
  }

  private inferSectionIcon(title: string): string {
    const iconMap: Record<string, string> = {
      wizja: 'flag',
      vision: 'flag',
      manifest: 'flag',
      przestrzeń: 'home',
      space: 'home',
      materia: 'cube',
      matter: 'cube',
      relacje: 'people',
      relations: 'people',
      interakcje: 'people',
      interactions: 'people',
      organizowanie: 'organization',
      organizing: 'organization',
      struktura: 'organization',
      structure: 'organization',
      zarządzanie: 'settings',
      management: 'settings',
    };

    const lowerTitle = title.toLowerCase();
    for (const [keyword, icon] of Object.entries(iconMap)) {
      if (lowerTitle.includes(keyword)) {
        return icon;
      }
    }

    return 'document-text';
  }

  private generateTemplateId(text: string): string {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `template_${hash.substring(0, 8)}`;
  }

  private generateSectionId(title: string, order: number): string {
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 20);
    return `section_${cleanTitle}_${order}`;
  }

  private generateQuestionId(
    text: string,
    sectionIndex: number,
    questionIndex: number,
  ): string {
    const hash = crypto
      .createHash('md5')
      .update(text)
      .digest('hex')
      .substring(0, 8);
    return `q_${sectionIndex}_${questionIndex}_${hash}`;
  }

  /**
   * Validates that a parsed template meets minimum requirements
   */
  validateTemplate(template: ParsedTemplate): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!template.title.pl && !template.title.en) {
      errors.push('Template must have a title');
    }

    if (template.sections.length === 0) {
      errors.push('Template must have at least one section');
    }

    let totalQuestions = 0;
    template.sections.forEach((section, sectionIndex) => {
      if (!section.title.pl && !section.title.en) {
        errors.push(`Section ${sectionIndex + 1} must have a title`);
      }

      if (section.questions.length === 0) {
        errors.push(
          `Section ${sectionIndex + 1} must have at least one question`,
        );
      }

      section.questions.forEach((question, questionIndex) => {
        if (!question.text.pl && !question.text.en) {
          errors.push(
            `Question ${sectionIndex + 1}.${questionIndex + 1} must have text`,
          );
        }

        totalQuestions++;
      });
    });

    if (totalQuestions === 0) {
      errors.push('Template must have at least one question');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
