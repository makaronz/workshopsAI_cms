-- Migration: Insert Default Prompt Template for Workshop Intelligence
-- Created: 2025-11-30
-- Description: Adds the default prompt template for LLM analysis

INSERT INTO prompt_templates (
  id,
  name,
  description,
  template_text,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Default Workshop Analysis',
  'Standard prompt template for analyzing workshop participant responses with comprehensive insights, themes, and recommendations.',
  'You are analyzing participant responses for a workshop titled "{workshop_title}".

Workshop Description: {workshop_description}

Number of Participants: {participant_count}

Participant Responses:
{participant_data}

Please analyze these responses and provide:

1. A comprehensive summary of the overall themes and patterns
2. Key insights with priority levels (high/medium/low)
3. Recurring themes with frequency counts and examples
4. Actionable recommendations for the workshop facilitator
5. A suggested workshop plan with specific activities

Focus on:
- What participants are hoping to achieve
- Common challenges or concerns
- Areas of high interest or enthusiasm
- Potential group dynamics
- Specific skills or topics to cover

Be specific, actionable, and tailored to this particular group of participants.',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
