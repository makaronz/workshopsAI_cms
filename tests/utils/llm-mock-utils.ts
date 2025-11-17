import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Mock OpenAI responses
export const createMockOpenAIResponse = (content: string, model = 'gpt-4') => ({
  id: 'chatcmpl-mock-id',
  object: 'chat.completion' as const,
  created: Date.now(),
  model,
  choices: [{
    index: 0,
    message: {
      role: 'assistant' as const,
      content,
    },
    finish_reason: 'stop' as const,
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
});

// Mock OpenAI streaming response
export const createMockOpenAIStreamResponse = (chunks: string[]) => {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        const data = `data: ${JSON.stringify({
          id: 'chatcmpl-mock-id',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { content: chunk },
            finish_reason: null,
          }],
        })}\n\n`;

        controller.enqueue(new TextEncoder().encode(data));
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
      }

      // Send final chunk
      const finalChunk = `data: ${JSON.stringify({
        id: 'chatcmpl-mock-id',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      })}\n\n`;

      controller.enqueue(new TextEncoder().encode(finalChunk));
      controller.close();
    },
  });

  return stream;
};

// Mock Anthropic responses
export const createMockAnthropicResponse = (content: string, model = 'claude-3-sonnet-20241022') => ({
  id: 'msg-mock-id',
  type: 'message' as const,
  role: 'assistant' as const,
  content: [{
    type: 'text' as const,
    text: content,
  }],
  model,
  stop_reason: 'end_turn' as const,
  stop_sequence: null,
  usage: {
    input_tokens: 100,
    output_tokens: 50,
  },
});

// Mock Anthropic streaming response
export const createMockAnthropicStreamResponse = (chunks: string[]) => {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        const data = {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'text_delta',
            text: chunk,
          },
        };

        controller.enqueue(JSON.stringify(data) + '\n');
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
      }

      // Send final event
      const finalEvent = {
        type: 'message_stop',
      };

      controller.enqueue(JSON.stringify(finalEvent) + '\n');
      controller.close();
    },
  });

  return stream;
};

// Mock LLM service class
export class MockLLMService {
  private openai: jest.Mocked<OpenAI>;
  private anthropic: jest.Mocked<Anthropic>;

  constructor() {
    this.openai = new OpenAI() as jest.Mocked<OpenAI>;
    this.anthropic = new Anthropic() as jest.Mocked<Anthropic>;

    // Mock OpenAI methods
    this.openai.chat = {
      completions: {
        create: jest.fn(),
      },
    } as any;

    this.openai.embeddings = {
      create: jest.fn(),
    } as any;

    // Mock Anthropic methods
    this.anthropic.messages = {
      create: jest.fn(),
    } as any;
  }

  // OpenAI mocks
  mockOpenAICompletion(content: string, options?: { model?: string; delay?: number }) {
    const response = createMockOpenAIResponse(content, options?.model);

    this.openai.chat.completions.create.mockResolvedValue(response);

    if (options?.delay) {
      this.openai.chat.completions.create.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, options.delay));
        return response;
      });
    }

    return this.openai.chat.completions.create;
  }

  mockOpenAIStream(chunks: string[], options?: { model?: string; delay?: number }) {
    const stream = createMockOpenAIStreamResponse(chunks);

    this.openai.chat.completions.create.mockResolvedValue({
      ...createMockOpenAIResponse('', options?.model),
      choices: [{
        index: 0,
        message: { role: 'assistant', content: '' },
        finish_reason: 'stop',
      }],
    } as any);

    // Override for streaming
    this.openai.chat.completions.create.mockImplementation(async (params: any) => {
      if (options?.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }

      if (params.stream) {
        return {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) {
              yield {
                choices: [{
                  delta: { content: chunk },
                  finish_reason: null,
                }],
              };
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            yield {
              choices: [{
                delta: {},
                finish_reason: 'stop',
              }],
            };
          },
        };
      }

      return createMockOpenAIResponse(chunks.join(''), options?.model);
    });

    return this.openai.chat.completions.create;
  }

  mockOpenAIEmbeddings(embedding: number[], options?: { model?: string; delay?: number }) {
    const response = {
      data: [{
        embedding,
        index: 0,
        object: 'embedding' as const,
      }],
      model: options?.model || 'text-embedding-ada-002',
      usage: {
        prompt_tokens: 10,
        total_tokens: 10,
      },
    };

    this.openai.embeddings.create.mockResolvedValue(response);

    if (options?.delay) {
      this.openai.embeddings.create.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, options.delay));
        return response;
      });
    }

    return this.openai.embeddings.create;
  }

  // Anthropic mocks
  mockAnthropicCompletion(content: string, options?: { model?: string; delay?: number }) {
    const response = createMockAnthropicResponse(content, options?.model);

    this.anthropic.messages.create.mockResolvedValue(response);

    if (options?.delay) {
      this.anthropic.messages.create.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, options.delay));
        return response;
      });
    }

    return this.anthropic.messages.create;
  }

  mockAnthropicStream(chunks: string[], options?: { model?: string; delay?: number }) {
    const stream = createMockAnthropicStreamResponse(chunks);

    this.anthropic.messages.create.mockImplementation(async (params: any) => {
      if (options?.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }

      if (params.stream) {
        return stream;
      }

      return createMockAnthropicResponse(chunks.join(''), options?.model);
    });

    return this.anthropic.messages.create;
  }

  // Utility methods
  getOpenAIClient(): jest.Mocked<OpenAI> {
    return this.openai;
  }

  getAnthropicClient(): jest.Mocked<Anthropic> {
    return this.anthropic;
  }

  resetMocks(): void {
    jest.clearAllMocks();
  }

  // Error simulation
  mockOpenAIError(error: Error, rateLimit = false) {
    if (rateLimit) {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      this.openai.chat.completions.create.mockRejectedValue(rateLimitError);
    } else {
      this.openai.chat.completions.create.mockRejectedValue(error);
    }
  }

  mockAnthropicError(error: Error) {
    this.anthropic.messages.create.mockRejectedValue(error);
  }

  // Call tracking
  getOpenAICallCount(): number {
    return this.openai.chat.completions.create.mock.calls.length;
  }

  getAnthropicCallCount(): number {
    return this.anthropic.messages.create.mock.calls.length;
  }

  getLastOpenAICall(): any {
    const calls = this.openai.chat.completions.create.mock.calls;
    return calls[calls.length - 1];
  }

  getLastAnthropicCall(): any {
    const calls = this.anthropic.messages.create.mock.calls;
    return calls[calls.length - 1];
  }
}

// Predefined response templates
export const LLMResponseTemplates = {
  thematic: {
    success: JSON.stringify({
      themes: [
        {
          name: 'User Experience',
          frequency: 8,
          examples: ['The interface is intuitive', 'Easy to navigate', 'Clear layout'],
        },
        {
          name: 'Performance',
          frequency: 5,
          examples: ['Fast loading', 'Responsive', 'No lag'],
        },
        {
          name: 'Features',
          frequency: 3,
          examples: ['Missing export functionality', 'Need more filters', 'Customization options'],
        },
      ],
      insights: [
        'Users generally appreciate the intuitive design',
        'Performance is a strong point of the application',
        'Users would like more advanced features',
      ],
    }),
  },

  sentiment: {
    positive: JSON.stringify({
      overall: 'positive',
      distribution: {
        positive: 75,
        negative: 10,
        neutral: 15,
      },
      insights: [
        'Overall sentiment is strongly positive',
        'Users are satisfied with the current functionality',
        'Few negative comments suggest minor issues',
      ],
    }),
  },

  clusters: {
    success: JSON.stringify({
      clusters: [
        {
          name: 'Technical Feedback',
          size: 6,
          centroid: 'Performance and technical issues',
          responses: ['Fast loading', 'Needs optimization', 'Good response time'],
        },
        {
          name: 'Feature Requests',
          size: 4,
          centroid: 'Desired functionality improvements',
          responses: ['Need dark mode', 'Export data', 'Better search'],
        },
      ],
    }),
  },
};

// Global mock instance
export const mockLLMService = new MockLLMService();

// Helper functions for common test scenarios
export const setupMockLLMSuccess = (provider: 'openai' | 'anthropic' = 'openai') => {
  if (provider === 'openai') {
    mockLLMService.mockOpenAICompletion(LLMResponseTemplates.thematic.success);
  } else {
    mockLLMService.mockAnthropicCompletion(LLMResponseTemplates.thematic.success);
  }
};

export const setupMockLLMError = (provider: 'openai' | 'anthropic' = 'openai') => {
  const error = new Error('API Error');
  if (provider === 'openai') {
    mockLLMService.mockOpenAIError(error);
  } else {
    mockLLMService.mockAnthropicError(error);
  }
};

export const setupMockLLMRateLimit = (provider: 'openai' | 'anthropic' = 'openai') => {
  if (provider === 'openai') {
    mockLLMService.mockOpenAIError(new Error('Rate limit exceeded'), true);
  } else {
    // Anthropic rate limits have different structure
    const rateLimitError = new Error('Rate limit exceeded');
    (rateLimitError as any).error = { type: 'rate_limit_error' };
    mockLLMService.mockAnthropicError(rateLimitError);
  }
};