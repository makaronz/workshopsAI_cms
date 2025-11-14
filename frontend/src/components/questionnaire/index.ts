/**
 * Questionnaire Components Index
 * Exports all questionnaire-related web components and utilities
 */

// Main components
export { default as QuestionnaireBuilder } from './questionnaire-builder.js';
export { default as QuestionEditor } from './question-editor.js';
export { default as QuestionGroupManager } from './question-group-manager.js';
export { default as QuestionnairePreview } from './questionnaire-preview.js';

// Question type components
export { default as QuestionTextInput } from './question-types/text-input.js';
export { default as QuestionScaleInput } from './question-types/scale-input.js';
export { default as QuestionChoiceInput } from './question-types/choice-input.js';

// Types and interfaces
export type {
  Questionnaire,
  QuestionGroup,
  Question,
  QuestionOption,
  QuestionValidation,
  ConditionalLogic,
  BilingualText,
  QuestionnaireBuilderConfig,
  QuestionEditorConfig,
  QuestionGroupManagerConfig,
  QuestionnairePreviewConfig
} from './questionnaire-builder.js';

export type {
  TextInputConfig
} from './question-types/text-input.js';

export type {
  ScaleInputConfig
} from './question-types/scale-input.js';

export type {
  ChoiceInputConfig
} from './question-types/choice-input.js';

// Utility functions
export const createEmptyQuestionnaire = (language: 'pl' | 'en' = 'en') => ({
  id: `questionnaire_${Date.now()}`,
  title: {
    pl: '',
    en: ''
  },
  description: {
    pl: '',
    en: ''
  },
  instructions: {
    pl: '',
    en: ''
  },
  settings: {
    anonymous: false,
    requireConsent: true,
    closeAfterWorkshop: true,
    showAllQuestions: true,
    allowEdit: true,
    questionStyle: 'first_person_plural' as const
  },
  status: 'draft' as const,
  groups: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

export const createEmptyQuestionGroup = (orderIndex: number = 0, language: 'pl' | 'en' = 'en') => ({
  id: `group_${Date.now()}_${orderIndex}`,
  title: {
    pl: `Nowa sekcja ${orderIndex + 1}`,
    en: `New Section ${orderIndex + 1}`
  },
  description: {
    pl: '',
    en: ''
  },
  orderIndex,
  uiConfig: {
    collapsed: false,
    showProgress: true,
    icon: null
  },
  questions: []
});

export const createEmptyQuestion = (type: Question['type'] = 'text', orderIndex: number = 0, language: 'pl' | 'en' = 'en') => ({
  id: `question_${Date.now()}_${orderIndex}`,
  text: {
    pl: 'Nowe pytanie',
    en: 'New Question'
  },
  type,
  validation: {
    required: false
  },
  orderIndex,
  helpText: {
    pl: '',
    en: ''
  }
});

export const createScaleOptions = (min: number, max: number, labels?: { pl: string[], en: string[] }) => {
  const options = [];
  for (let i = min; i <= max; i++) {
    const index = i - min;
    options.push({
      id: `scale_${i}`,
      value: i.toString(),
      label: {
        pl: labels?.pl[index] || i.toString(),
        en: labels?.en[index] || i.toString()
      }
    });
  }
  return options;
};

export const validateQuestionnaire = (questionnaire: Questionnaire): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check if questionnaire has a title
  if (!questionnaire.title.pl && !questionnaire.title.en) {
    errors.push('Questionnaire must have a title in at least one language');
  }

  // Check if questionnaire has at least one group
  if (questionnaire.groups.length === 0) {
    errors.push('Questionnaire must have at least one section');
  }

  // Check each group
  questionnaire.groups.forEach((group, groupIndex) => {
    // Check if group has a title
    if (!group.title.pl && !group.title.en) {
      errors.push(`Section ${groupIndex + 1} must have a title in at least one language`);
    }

    // Check if group has at least one question
    if (group.questions.length === 0) {
      errors.push(`Section ${groupIndex + 1} must have at least one question`);
    }

    // Check each question
    group.questions.forEach((question, questionIndex) => {
      // Check if question has text
      if (!question.text.pl && !question.text.en) {
        errors.push(`Question ${questionIndex + 1} in section ${groupIndex + 1} must have text in at least one language`);
      }

      // Check if choice questions have options
      if ((question.type === 'single_choice' || question.type === 'multiple_choice') &&
          (!question.options || question.options.length === 0)) {
        errors.push(`Choice question ${questionIndex + 1} in section ${groupIndex + 1} must have options`);
      }

      // Check if scale questions have valid range
      if (question.type === 'scale') {
        const min = question.validation?.minValue || 1;
        const max = question.validation?.maxValue || 5;
        if (min >= max) {
          errors.push(`Scale question ${questionIndex + 1} in section ${groupIndex + 1} must have a valid range (min < max)`);
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const exportQuestionnaire = (questionnaire: Questionnaire): string => {
  return JSON.stringify(questionnaire, null, 2);
};

export const importQuestionnaire = (jsonString: string): Questionnaire => {
  try {
    const imported = JSON.parse(jsonString);

    // Validate basic structure
    if (!imported.id || !imported.title || !Array.isArray(imported.groups)) {
      throw new Error('Invalid questionnaire format');
    }

    return imported as Questionnaire;
  } catch (error) {
    throw new Error(`Failed to import questionnaire: ${error.message}`);
  }
};

// Template generators
export const generateLikertScaleTemplate = (language: 'pl' | 'en' = 'en'): Questionnaire => {
  const baseQuestionnaire = createEmptyQuestionnaire(language);

  baseQuestionnaire.title = {
    pl: 'Kwestionariusz Likerta',
    en: 'Likert Scale Questionnaire'
  };

  baseQuestionnaire.description = {
    pl: 'Standardowy kwestionariusz ze skalą Likerta do oceny opinii i postaw',
    en: 'Standard Likert scale questionnaire for measuring opinions and attitudes'
  };

  baseQuestionnaire.groups = [
    {
      ...createEmptyQuestionGroup(0, language),
      title: {
        pl: 'Ocena ogólna',
        en: 'Overall Assessment'
      },
      questions: [
        {
          ...createEmptyQuestion('scale', 0, language),
          text: {
            pl: 'Jak oceniasz ogólną jakość produktu/usługi?',
            en: 'How would you rate the overall quality of the product/service?'
          },
          validation: {
            required: true,
            minValue: 1,
            maxValue: 5
          },
          options: createScaleOptions(1, 5, {
            pl: ['Bardzo źle', 'Źle', 'Średnio', 'Dobrze', 'Bardzo dobrze'],
            en: ['Very Poor', 'Poor', 'Fair', 'Good', 'Very Good']
          })
        }
      ]
    }
  ];

  return baseQuestionnaire;
};

export const generateFeedbackTemplate = (language: 'pl' | 'en' = 'en'): Questionnaire => {
  const baseQuestionnaire = createEmptyQuestionnaire(language);

  baseQuestionnaire.title = {
    pl: 'Formularz opinii',
    en: 'Feedback Form'
  };

  baseQuestionnaire.description = {
    pl: 'Zbieranie opinii i sugestii od uczestników',
    en: 'Collecting feedback and suggestions from participants'
  };

  baseQuestionnaire.groups = [
    {
      ...createEmptyQuestionGroup(0, language),
      title: {
        pl: 'Twoje opinie',
        en: 'Your Feedback'
      },
      questions: [
        {
          ...createEmptyQuestion('textarea', 0, language),
          text: {
            pl: 'Co podobało Ci się najbardziej?',
            en: 'What did you like the most?'
          },
          validation: {
            required: true,
            maxLength: 500
          }
        },
        {
          ...createEmptyQuestion('textarea', 1, language),
          text: {
            pl: 'Co możemy poprawić?',
            en: 'What could we improve?'
          },
          validation: {
            maxLength: 500
          }
        },
        {
          ...createEmptyQuestion('scale', 2, language),
          text: {
            pl: 'Jak prawdopodobne jest, że polecisz nas innym?',
            en: 'How likely are you to recommend us to others?'
          },
          validation: {
            required: true,
            minValue: 0,
            maxValue: 10
          },
          options: createScaleOptions(0, 10, {
            pl: Array.from({length: 11}, (_, i) => i.toString()),
            en: Array.from({length: 11}, (_, i) => i.toString())
          })
        }
      ]
    }
  ];

  return baseQuestionnaire;
};

export const generateDemographicsTemplate = (language: 'pl' | 'en' = 'en'): Questionnaire => {
  const baseQuestionnaire = createEmptyQuestionnaire(language);

  baseQuestionnaire.title = {
    pl: 'Dane demograficzne',
    en: 'Demographics'
  };

  baseQuestionnaire.description = {
    pl: 'Pomocne informacje demograficzne (opcjonalne)',
    en: 'Helpful demographic information (optional)'
  };

  baseQuestionnaire.settings.anonymous = true;
  baseQuestionnaire.settings.requireConsent = true;

  baseQuestionnaire.groups = [
    {
      ...createEmptyQuestionGroup(0, language),
      title: {
        pl: 'Podstawowe informacje',
        en: 'Basic Information'
      },
      questions: [
        {
          ...createEmptyQuestion('single_choice', 0, language),
          text: {
            pl: 'Grupa wiekowa',
            en: 'Age Group'
          },
          options: [
            { id: 'age1', value: '18-24', label: { pl: '18-24', en: '18-24' } },
            { id: 'age2', value: '25-34', label: { pl: '25-34', en: '25-34' } },
            { id: 'age3', value: '35-44', label: { pl: '35-44', en: '35-44' } },
            { id: 'age4', value: '45-54', label: { pl: '45-54', en: '45-54' } },
            { id: 'age5', value: '55+', label: { pl: '55+', en: '55+' } }
          ]
        },
        {
          ...createEmptyQuestion('text', 1, language),
          text: {
            pl: 'Miasto zamieszkania',
            en: 'City of Residence'
          },
          validation: {
            maxLength: 100
          }
        }
      ]
    }
  ];

  return baseQuestionnaire;
};