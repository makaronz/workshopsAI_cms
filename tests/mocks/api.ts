/**
 * API Mock Utilities
 * Comprehensive mock implementations for API endpoints and external services
 */

import { Request, Response } from 'express';

export interface MockApiResponse {
  status: number;
  data: any;
  headers?: Record<string, string>;
}

export class MockApiServer {
  private routes: Map<string, Map<string, Function>> = new Map();
  private middlewares: Function[] = [];

  constructor() {
    this.setupDefaultRoutes();
  }

  private setupDefaultRoutes() {
    // Authentication routes
    this.post('/api/auth/login', this.mockLogin);
    this.post('/api/auth/register', this.mockRegister);
    this.post('/api/auth/refresh', this.mockRefreshToken);
    this.post('/api/auth/logout', this.mockLogout);

    // Workshop routes
    this.get('/api/workshops', this.mockGetWorkshops);
    this.post('/api/workshops', this.mockCreateWorkshop);
    this.get('/api/workshops/:id', this.mockGetWorkshop);
    this.put('/api/workshops/:id', this.mockUpdateWorkshop);
    this.delete('/api/workshops/:id', this.mockDeleteWorkshop);

    // Questionnaire routes
    this.get('/api/questionnaires', this.mockGetQuestionnaires);
    this.post('/api/questionnaires', this.mockCreateQuestionnaire);
    this.get('/api/questionnaires/:id', this.mockGetQuestionnaire);
    this.put('/api/questionnaires/:id', this.mockUpdateQuestionnaire);
    this.delete('/api/questionnaires/:id', this.mockDeleteQuestionnaire);

    // User routes
    this.get('/api/users/profile', this.mockGetUserProfile);
    this.put('/api/users/profile', this.mockUpdateUserProfile);
    this.get('/api/users/:id', this.mockGetUser);
  }

  // HTTP method decorators
  get(path: string, handler: Function) {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: Function) {
    this.addRoute('POST', path, handler);
  }

  put(path: string, handler: Function) {
    this.addRoute('PUT', path, handler);
  delete(path: string, handler: Function) {
    this.addRoute('DELETE', path, handler);
  }

  patch(path: string, handler: Function) {
    this.addRoute('PATCH', path, handler);
  }

  private addRoute(method: string, path: string, handler: Function) {
    if (!this.routes.has(method)) {
      this.routes.set(method, new Map());
    }
    this.routes.get(method)!.set(path, handler);
  }

  // Middleware support
  use(middleware: Function) {
    this.middlewares.push(middleware);
  }

  // Request handling
  async request(method: string, path: string, data?: any, headers?: Record<string, string>): Promise<MockApiResponse> {
    const mockReq = {
      method,
      path,
      body: data,
      headers: headers || {},
      params: this.extractParams(path),
      query: this.extractQuery(path)
    } as Request;

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      locals: {}
    } as any;

    // Run middlewares
    for (const middleware of this.middlewares) {
      await middleware(mockReq, mockRes, () => {});
    }

    // Find and execute route handler
    const methodRoutes = this.routes.get(method.toUpperCase());
    if (methodRoutes) {
      for (const [routePath, handler] of methodRoutes) {
        if (this.pathMatches(path, routePath)) {
          mockReq.params = this.extractRouteParams(path, routePath);
          try {
            await handler(mockReq, mockRes);
            return {
              status: mockRes.status.mock.calls[0]?.[0] || 200,
              data: mockRes.json.mock.calls[0]?.[0] || mockRes.send.mock.calls[0]?.[0],
              headers: mockRes.set.mock.calls.reduce((acc: any, call: any) => {
                acc[call[0]] = call[1];
                return acc;
              }, {})
            };
          } catch (error) {
            return {
              status: 500,
              data: { error: 'Internal server error' }
            };
          }
        }
      }
    }

    return {
      status: 404,
      data: { error: 'Route not found' }
    };
  }

  private pathMatches(requestPath: string, routePath: string): boolean {
    // Simple path matching (in a real implementation, this would be more sophisticated)
    const routeSegments = routePath.split('/').filter(s => s);
    const requestSegments = requestPath.split('/').filter(s => s && !s.includes('?'));

    if (routeSegments.length !== requestSegments.length) {
      return false;
    }

    return routeSegments.every((segment, index) => {
      return segment.startsWith(':') || segment === requestSegments[index];
    });
  }

  private extractRouteParams(requestPath: string, routePath: string): Record<string, string> {
    const params: Record<string, string> = {};
    const routeSegments = routePath.split('/').filter(s => s);
    const requestSegments = requestPath.split('/').filter(s => s && !s.includes('?'));

    routeSegments.forEach((segment, index) => {
      if (segment.startsWith(':')) {
        const paramName = segment.slice(1);
        params[paramName] = requestSegments[index];
      }
    });

    return params;
  }

  private extractParams(path: string): Record<string, string> {
    const params: Record<string, string> = {};
    const queryStart = path.indexOf('?');
    if (queryStart !== -1) {
      const queryString = path.slice(queryStart + 1);
      const pairs = queryString.split('&');
      pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) {
          params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
      });
    }
    return params;
  }

  private extractQuery(path: string): Record<string, string> {
    return this.extractParams(path);
  }

  // Mock route handlers
  private async mockLogin(req: Request, res: Response) {
    const { email, password } = req.body;

    if (email === 'admin@test.com' && password === 'password') {
      res.status(200).json({
        user: {
          id: '1',
          email: 'admin@test.com',
          username: 'admin',
          role: 'admin'
        },
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token'
      });
    } else if (email === 'user@test.com' && password === 'password') {
      res.status(200).json({
        user: {
          id: '2',
          email: 'user@test.com',
          username: 'testuser',
          role: 'user'
        },
        token: 'mock-jwt-token-user',
        refreshToken: 'mock-refresh-token-user'
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  }

  private async mockRegister(req: Request, res: Response) {
    const { email, username, firstName, lastName, password } = req.body;

    // Simulate user creation
    const newUser = {
      id: Date.now().toString(),
      email,
      username,
      firstName,
      lastName,
      role: 'user'
    };

    res.status(201).json({
      user: newUser,
      token: 'mock-jwt-token-new-user',
      refreshToken: 'mock-refresh-token-new-user'
    });
  }

  private async mockRefreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;

    if (refreshToken === 'mock-refresh-token') {
      res.status(200).json({
        token: 'new-mock-jwt-token',
        refreshToken: 'new-mock-refresh-token'
      });
    } else {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }

  private async mockLogout(req: Request, res: Response) {
    res.status(200).json({ message: 'Logged out successfully' });
  }

  private async mockGetWorkshops(req: Request, res: Response) {
    const workshops = [
      {
        id: '1',
        title: 'Test Workshop 1',
        description: 'A test workshop',
        slug: 'test-workshop-1',
        status: 'published',
        maxParticipants: 20,
        currentParticipants: 5,
        createdBy: {
          id: '1',
          username: 'admin'
        },
        createdAt: new Date().toISOString()
      }
    ];

    res.status(200).json({ workshops, total: workshops.length });
  }

  private async mockCreateWorkshop(req: Request, res: Response) {
    const workshopData = req.body;
    const newWorkshop = {
      id: Date.now().toString(),
      ...workshopData,
      status: 'draft',
      currentParticipants: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(201).json(newWorkshop);
  }

  private async mockGetWorkshop(req: Request, res: Response) {
    const { id } = req.params;

    if (id === '1') {
      const workshop = {
        id: '1',
        title: 'Test Workshop 1',
        description: 'A test workshop',
        slug: 'test-workshop-1',
        status: 'published',
        maxParticipants: 20,
        currentParticipants: 5,
        createdBy: {
          id: '1',
          username: 'admin'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      res.status(200).json(workshop);
    } else {
      res.status(404).json({ error: 'Workshop not found' });
    }
  }

  private async mockUpdateWorkshop(req: Request, res: Response) {
    const { id } = req.params;
    const updateData = req.body;

    if (id === '1') {
      const updatedWorkshop = {
        id: '1',
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      res.status(200).json(updatedWorkshop);
    } else {
      res.status(404).json({ error: 'Workshop not found' });
    }
  }

  private async mockDeleteWorkshop(req: Request, res: Response) {
    const { id } = req.params;

    if (id === '1') {
      res.status(200).json({ message: 'Workshop deleted successfully' });
    } else {
      res.status(404).json({ error: 'Workshop not found' });
    }
  }

  private async mockGetQuestionnaires(req: Request, res: Response) {
    const questionnaires = [
      {
        id: '1',
        title: 'Test Questionnaire',
        description: 'A test questionnaire',
        workshopId: '1',
        questions: [
          {
            id: 'q1',
            type: 'text',
            title: 'What is your name?',
            required: true
          }
        ],
        createdBy: {
          id: '1',
          username: 'admin'
        },
        createdAt: new Date().toISOString()
      }
    ];

    res.status(200).json({ questionnaires, total: questionnaires.length });
  }

  private async mockCreateQuestionnaire(req: Request, res: Response) {
    const questionnaireData = req.body;
    const newQuestionnaire = {
      id: Date.now().toString(),
      ...questionnaireData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(201).json(newQuestionnaire);
  }

  private async mockGetQuestionnaire(req: Request, res: Response) {
    const { id } = req.params;

    if (id === '1') {
      const questionnaire = {
        id: '1',
        title: 'Test Questionnaire',
        description: 'A test questionnaire',
        workshopId: '1',
        questions: [
          {
            id: 'q1',
            type: 'text',
            title: 'What is your name?',
            required: true
          }
        ],
        createdBy: {
          id: '1',
          username: 'admin'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      res.status(200).json(questionnaire);
    } else {
      res.status(404).json({ error: 'Questionnaire not found' });
    }
  }

  private async mockUpdateQuestionnaire(req: Request, res: Response) {
    const { id } = req.params;
    const updateData = req.body;

    if (id === '1') {
      const updatedQuestionnaire = {
        id: '1',
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      res.status(200).json(updatedQuestionnaire);
    } else {
      res.status(404).json({ error: 'Questionnaire not found' });
    }
  }

  private async mockDeleteQuestionnaire(req: Request, res: Response) {
    const { id } = req.params;

    if (id === '1') {
      res.status(200).json({ message: 'Questionnaire deleted successfully' });
    } else {
      res.status(404).json({ error: 'Questionnaire not found' });
    }
  }

  private async mockGetUserProfile(req: Request, res: Response) {
    res.status(200).json({
      id: '1',
      email: 'admin@test.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    });
  }

  private async mockUpdateUserProfile(req: Request, res: Response) {
    const updateData = req.body;
    const updatedUser = {
      id: '1',
      email: 'admin@test.com',
      username: 'admin',
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    res.status(200).json(updatedUser);
  }

  private async mockGetUser(req: Request, res: Response) {
    const { id } = req.params;

    if (id === '1') {
      res.status(200).json({
        id: '1',
        email: 'admin@test.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  }
}

// Export singleton instance
export const mockApiServer = new MockApiServer();

// Mock fetch implementation
export const mockFetch = jest.fn().mockImplementation(async (url: string, options?: RequestInit) => {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body as string) : undefined;

  // Convert URL to path for our mock server
  const urlObj = new URL(url);
  const path = urlObj.pathname + urlObj.search;

  const response = await mockApiServer.request(method, path, body);

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.status >= 200 && response.status < 300 ? 'OK' : 'Error',
    json: async () => response.data,
    text: async () => JSON.stringify(response.data),
    headers: new Map(Object.entries(response.headers || {}))
  } as Response;
});

// Setup global fetch mock
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true
});