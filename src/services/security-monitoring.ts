import { createHash, randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Security Monitoring and Alerting Service
 * Implements real-time threat detection and automated security responses
 */

// Security event types
export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'authentication_failure',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHORIZATION_FAILURE = 'authorization_failure',
  SUSPICIOUS_REQUEST = 'suspicious_request',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  MALICIOUS_PAYLOAD = 'malicious_payload',
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior',
  SESSION_HIJACKING = 'session_hijacking',
  BRUTE_FORCE_ATTACK = 'brute_force_attack',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  CSRF_ATTEMPT = 'csrf_attempt',
}

// Security event severity levels
export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Security event interface
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  ip: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  details: Record<string, any>;
  resolved: boolean;
  responseActions?: string[];
}

// Threat pattern definitions
const THREAT_PATTERNS = {
  SQL_INJECTION: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\'(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\bUNION\s+SELECT\b)/i,
    /(\/\*.*?\*\/|--.*$)/im,
  ],
  XSS: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=\s*["'][^"']*["']/i,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
  ],
  PATH_TRAVERSAL: [
    /\.\.[\/\\]/,
    /%2e%2e[\/\\]/i,
    /..\//,
    /..\\/,
  ],
  COMMAND_INJECTION: [
    /[;&|`$(){}[\]]/,
    /\b(cat|ls|dir|pwd|whoami|uname|id)\b/i,
    /\b(rm|del|format|fdisk)\b/i,
  ],
  LDAP_INJECTION: [
    /[()=,*!*]/,
    /\*\)/,
    /\(\|\(/,
  ],
  NO_SQL_INJECTION: [
    /\{?\s*\$.*?\}/,
    /\[\?\]/,
    /\$where/,
    /\$ne/,
    /\$gt/,
    /\$lt/,
  ],
};

// Suspicious user agents
const SUSPICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nmap/i,
  /nikto/i,
  /burp/i,
  /owasp/i,
  /nuclei/i,
  /masscan/i,
  /zap/i,
  /python-requests/i,
  /curl/i,
];

// Rate limiting configurations
const RATE_LIMIT_THRESHOLDS = {
  requests_per_minute: 60,
  requests_per_hour: 1000,
  failed_auth_per_minute: 5,
  failed_auth_per_hour: 20,
  suspicious_requests_per_minute: 10,
};

/**
 * Security Monitoring Service
 */
export class SecurityMonitoringService {
  private events: SecurityEvent[] = [];
  private ipReputations: Map<string, { score: number; lastUpdated: Date }> = new Map();
  private userBehaviors: Map<string, any> = new Map();
  private alertCallbacks: Array<(event: SecurityEvent) => void> = [];

  constructor() {
    // Start background monitoring
    this.startBackgroundMonitoring();
  }

  /**
   * Record a security event
   */
  public recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): SecurityEvent {
    const securityEvent: SecurityEvent = {
      ...event,
      id: randomBytes(16).toString('hex'),
      timestamp: new Date(),
      resolved: false,
    };

    this.events.push(securityEvent);

    // Update IP reputation
    this.updateIPReputation(event.ip, event.severity);

    // Check for automated response requirements
    this.checkAutomatedResponse(securityEvent);

    // Trigger alerts
    this.triggerAlerts(securityEvent);

    return securityEvent;
  }

  /**
   * Analyze request for threats
   */
  public analyzeRequest(req: Request, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];
    const requestData = this.serializeRequestData(req);

    // Check for various attack patterns
    events.push(...this.checkSQLInjection(req, requestData, userId, sessionId));
    events.push(...this.checkXSS(req, requestData, userId, sessionId));
    events.push(...this.checkPathTraversal(req, requestData, userId, sessionId));
    events.push(...this.checkCommandInjection(req, requestData, userId, sessionId));
    events.push(...this.checkLDAPInjection(req, requestData, userId, sessionId));
    events.push(...this.checkNoSQLInjection(req, requestData, userId, sessionId));
    events.push(...this.checkSuspiciousUserAgent(req, userId, sessionId));
    events.push(...this.checkAnomalousBehavior(req, userId, sessionId));

    return events;
  }

  /**
   * Check for SQL injection attempts
   */
  private checkSQLInjection(req: Request, requestData: string, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];

    for (const pattern of THREAT_PATTERNS.SQL_INJECTION) {
      if (pattern.test(requestData)) {
        const event = this.recordEvent({
          type: SecurityEventType.SQL_INJECTION_ATTEMPT,
          severity: SecuritySeverity.HIGH,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          userId,
          sessionId,
          details: {
            pattern: pattern.source,
            url: req.url,
            method: req.method,
            matchedData: requestData.match(pattern)?.[0],
          },
        });

        events.push(event);
      }
    }

    return events;
  }

  /**
   * Check for XSS attempts
   */
  private checkXSS(req: Request, requestData: string, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];

    for (const pattern of THREAT_PATTERNS.XSS) {
      if (pattern.test(requestData)) {
        const event = this.recordEvent({
          type: SecurityEventType.XSS_ATTEMPT,
          severity: SecuritySeverity.HIGH,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          userId,
          sessionId,
          details: {
            pattern: pattern.source,
            url: req.url,
            method: req.method,
            matchedData: requestData.match(pattern)?.[0],
          },
        });

        events.push(event);
      }
    }

    return events;
  }

  /**
   * Check for path traversal attempts
   */
  private checkPathTraversal(req: Request, requestData: string, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];

    for (const pattern of THREAT_PATTERNS.PATH_TRAVERSAL) {
      if (pattern.test(requestData)) {
        const event = this.recordEvent({
          type: SecurityEventType.DATA_BREACH_ATTEMPT,
          severity: SecuritySeverity.HIGH,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          userId,
          sessionId,
          details: {
            attackType: 'path_traversal',
            pattern: pattern.source,
            url: req.url,
            method: req.method,
            matchedData: requestData.match(pattern)?.[0],
          },
        });

        events.push(event);
      }
    }

    return events;
  }

  /**
   * Check for command injection attempts
   */
  private checkCommandInjection(req: Request, requestData: string, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];

    for (const pattern of THREAT_PATTERNS.COMMAND_INJECTION) {
      if (pattern.test(requestData)) {
        const event = this.recordEvent({
          type: SecurityEventType.DATA_BREACH_ATTEMPT,
          severity: SecuritySeverity.CRITICAL,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          userId,
          sessionId,
          details: {
            attackType: 'command_injection',
            pattern: pattern.source,
            url: req.url,
            method: req.method,
            matchedData: requestData.match(pattern)?.[0],
          },
        });

        events.push(event);
      }
    }

    return events;
  }

  /**
   * Check for LDAP injection attempts
   */
  private checkLDAPInjection(req: Request, requestData: string, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];

    for (const pattern of THREAT_PATTERNS.LDAP_INJECTION) {
      if (pattern.test(requestData)) {
        const event = this.recordEvent({
          type: SecurityEventType.DATA_BREACH_ATTEMPT,
          severity: SecuritySeverity.HIGH,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          userId,
          sessionId,
          details: {
            attackType: 'ldap_injection',
            pattern: pattern.source,
            url: req.url,
            method: req.method,
            matchedData: requestData.match(pattern)?.[0],
          },
        });

        events.push(event);
      }
    }

    return events;
  }

  /**
   * Check for NoSQL injection attempts
   */
  private checkNoSQLInjection(req: Request, requestData: string, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];

    for (const pattern of THREAT_PATTERNS.NO_SQL_INJECTION) {
      if (pattern.test(requestData)) {
        const event = this.recordEvent({
          type: SecurityEventType.DATA_BREACH_ATTEMPT,
          severity: SecuritySeverity.HIGH,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          userId,
          sessionId,
          details: {
            attackType: 'nosql_injection',
            pattern: pattern.source,
            url: req.url,
            method: req.method,
            matchedData: requestData.match(pattern)?.[0],
          },
        });

        events.push(event);
      }
    }

    return events;
  }

  /**
   * Check for suspicious user agents
   */
  private checkSuspiciousUserAgent(req: Request, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];
    const userAgent = req.headers['user-agent'] || '';

    for (const pattern of SUSPICIOUS_USER_AGENTS) {
      if (pattern.test(userAgent)) {
        const event = this.recordEvent({
          type: SecurityEventType.SUSPICIOUS_REQUEST,
          severity: SecuritySeverity.MEDIUM,
          ip: req.ip,
          userAgent,
          userId,
          sessionId,
          details: {
            suspiciousAgent: userAgent,
            pattern: pattern.source,
            url: req.url,
            method: req.method,
          },
        });

        events.push(event);
      }
    }

    return events;
  }

  /**
   * Check for anomalous behavior
   */
  private checkAnomalousBehavior(req: Request, userId?: string, sessionId?: string): SecurityEvent[] {
    const events: SecurityEvent[] = [];

    if (!userId) return events;

    const behavior = this.userBehaviors.get(userId) || {
      requestCount: 0,
      uniqueIPs: new Set(),
      lastActivity: new Date(),
      requestPatterns: new Map(),
    };

    // Update behavior data
    behavior.requestCount++;
    behavior.uniqueIPs.add(req.ip);
    behavior.lastActivity = new Date();

    const patternKey = `${req.method}:${req.path.split('?')[0]}`;
    behavior.requestPatterns.set(patternKey, (behavior.requestPatterns.get(patternKey) || 0) + 1);

    // Check for anomalies
    if (behavior.uniqueIPs.size > 5) {
      const event = this.recordEvent({
        type: SecurityEventType.ANOMALOUS_BEHAVIOR,
        severity: SecuritySeverity.MEDIUM,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId,
        sessionId,
        details: {
          anomalyType: 'multiple_ips',
          uniqueIPCount: behavior.uniqueIPs.size,
          requestCount: behavior.requestCount,
        },
      });

      events.push(event);
    }

    if (behavior.requestCount > 1000) {
      const event = this.recordEvent({
        type: SecurityEventType.ANOMALOUS_BEHAVIOR,
        severity: SecuritySeverity.HIGH,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId,
        sessionId,
        details: {
          anomalyType: 'high_request_volume',
          requestCount: behavior.requestCount,
          uniqueIPCount: behavior.uniqueIPs.size,
        },
      });

      events.push(event);
    }

    this.userBehaviors.set(userId, behavior);
    return events;
  }

  /**
   * Update IP reputation score
   */
  private updateIPReputation(ip: string, severity: SecuritySeverity): void {
    const current = this.ipReputations.get(ip) || { score: 0, lastUpdated: new Date() };

    const scoreChanges = {
      [SecuritySeverity.LOW]: -1,
      [SecuritySeverity.MEDIUM]: -5,
      [SecuritySeverity.HIGH]: -10,
      [SecuritySeverity.CRITICAL]: -25,
    };

    current.score += scoreChanges[severity];
    current.lastUpdated = new Date();

    this.ipReputations.set(ip, current);
  }

  /**
   * Check if automated response is needed
   */
  private checkAutomatedResponse(event: SecurityEvent): void {
    if (event.severity === SecuritySeverity.CRITICAL) {
      this.implementBlockingResponse(event.ip);
    }

    if (event.type === SecurityEventType.BRUTE_FORCE_ATTACK) {
      this.implementRateLimiting(event.ip);
    }
  }

  /**
   * Implement IP blocking
   */
  private implementBlockingResponse(ip: string): void {
    // This would integrate with your firewall or load balancer
    console.warn(`CRITICAL: Blocking IP ${ip} due to security threat`);

    // Add to blocked IPs list (would be stored in Redis or database)
    // This is a placeholder - implement actual blocking mechanism
  }

  /**
   * Implement enhanced rate limiting
   */
  private implementRateLimiting(ip: string): void {
    // This would integrate with your rate limiting middleware
    console.warn(`SECURITY: Implementing enhanced rate limiting for IP ${ip}`);

    // Add to enhanced rate limiting list
    // This is a placeholder - implement actual rate limiting
  }

  /**
   * Trigger security alerts
   */
  private triggerAlerts(event: SecurityEvent): void {
    // Send to all registered alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Alert callback error:', error);
      }
    });

    // Log high severity events
    if (event.severity === SecuritySeverity.HIGH || event.severity === SecuritySeverity.CRITICAL) {
      console.error(`SECURITY ALERT [${event.severity.toUpperCase()}]: ${event.type}`, {
        id: event.id,
        ip: event.ip,
        timestamp: event.timestamp,
        details: event.details,
      });
    }
  }

  /**
   * Register alert callback
   */
  public registerAlertCallback(callback: (event: SecurityEvent) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get IP reputation
   */
  public getIPReputation(ip: string): number {
    return this.ipReputations.get(ip)?.score || 0;
  }

  /**
   * Get security events
   */
  public getEvents(filters?: {
    type?: SecurityEventType;
    severity?: SecuritySeverity;
    ip?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): SecurityEvent[] {
    let filtered = [...this.events];

    if (filters) {
      if (filters.type) {
        filtered = filtered.filter(event => event.type === filters.type);
      }
      if (filters.severity) {
        filtered = filtered.filter(event => event.severity === filters.severity);
      }
      if (filters.ip) {
        filtered = filtered.filter(event => event.ip === filters.ip);
      }
      if (filters.userId) {
        filtered = filtered.filter(event => event.userId === filters.userId);
      }
      if (filters.startDate) {
        filtered = filtered.filter(event => event.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(event => event.timestamp <= filters.endDate!);
      }
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get security statistics
   */
  public getStatistics(): {
    totalEvents: number;
    criticalEvents: number;
    highEvents: number;
    mediumEvents: number;
    lowEvents: number;
    uniqueIPs: number;
    uniqueUsers: number;
    topThreats: Array<{ type: string; count: number }>;
  } {
    const totalEvents = this.events.length;
    const criticalEvents = this.events.filter(e => e.severity === SecuritySeverity.CRITICAL).length;
    const highEvents = this.events.filter(e => e.severity === SecuritySeverity.HIGH).length;
    const mediumEvents = this.events.filter(e => e.severity === SecuritySeverity.MEDIUM).length;
    const lowEvents = this.events.filter(e => e.severity === SecuritySeverity.LOW).length;

    const uniqueIPs = new Set(this.events.map(e => e.ip)).size;
    const uniqueUsers = new Set(this.events.map(e => e.userId).filter(Boolean)).size;

    const threatCounts = new Map<string, number>();
    this.events.forEach(event => {
      threatCounts.set(event.type, (threatCounts.get(event.type) || 0) + 1);
    });

    const topThreats = Array.from(threatCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents,
      criticalEvents,
      highEvents,
      mediumEvents,
      lowEvents,
      uniqueIPs,
      uniqueUsers,
      topThreats,
    };
  }

  /**
   * Serialize request data for analysis
   */
  private serializeRequestData(req: Request): string {
    return JSON.stringify({
      url: req.url,
      method: req.method,
      query: req.query,
      params: req.params,
      body: req.body,
      headers: req.headers,
    });
  }

  /**
   * Start background monitoring
   */
  private startBackgroundMonitoring(): void {
    // Clean up old events every hour
    setInterval(() => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.events = this.events.filter(event => event.timestamp > oneWeekAgo);
    }, 60 * 60 * 1000);

    // Clean up old IP reputations every day
    setInterval(() => {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      for (const [ip, data] of this.ipReputations.entries()) {
        if (data.lastUpdated < oneMonthAgo) {
          this.ipReputations.delete(ip);
        }
      }
    }, 24 * 60 * 60 * 1000);
  }
}

// Global security monitoring instance
export const securityMonitor = new SecurityMonitoringService();

/**
 * Security monitoring middleware
 */
export const securityMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Analyze request for threats
  const events = securityMonitor.analyzeRequest(
    req,
    req.user?.id,
    req.session?.id
  );

  // Log any detected threats
  events.forEach(event => {
    console.warn(`Security threat detected: ${event.type} from ${req.ip}`);
  });

  // If critical threats are detected, block the request
  const criticalEvents = events.filter(e => e.severity === SecuritySeverity.CRITICAL);
  if (criticalEvents.length > 0) {
    return res.status(403).json({
      error: 'Access Denied',
      message: 'Request blocked due to security concerns',
      eventId: criticalEvents[0].id,
    });
  }

  next();
};

/**
 * Security metrics and reporting
 */
export const getSecurityMetrics = () => {
  return securityMonitor.getStatistics();
};

export const getSecurityEvents = (filters?: any) => {
  return securityMonitor.getEvents(filters);
};

export const blockIP = (ip: string, reason: string) => {
  const event = securityMonitor.recordEvent({
    type: SecurityEventType.UNAUTHORIZED_ACCESS,
    severity: SecuritySeverity.HIGH,
    ip,
    details: { action: 'manual_block', reason },
  });

  securityMonitor.implementBlockingResponse(ip);
  return event;
};

export const isIPBlocked = (ip: string): boolean => {
  return securityMonitor.getIPReputation(ip) < -50;
};

export {
  SecurityEventType,
  SecuritySeverity,
  securityMonitor as default,
};