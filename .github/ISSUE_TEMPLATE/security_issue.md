---
name: Security Issue
about: Report a security vulnerability or privacy concern
title: "[SECURITY] "
labels: ["type:bug", "cms:security", "priority:high", "auto-triage"]
assignees: ''
---

## 🔒 Security Issue Description

**CRITICAL: If this is a high-severity security vulnerability, please do not disclose details publicly. Email security@workshopsai.com instead.**

A clear description of the security vulnerability or privacy concern.

## 🎯 Impact Assessment

**Severity Level:**
- [ ] **Critical** - System compromise, data breach, or complete service disruption
- [ ] **High** - Significant data exposure, privilege escalation, or major functionality impact
- [ ] **Medium** - Limited data exposure, minor privilege escalation, or partial functionality impact
- [ ] **Low** - Information disclosure, minor functionality impact, or policy violation

**Affected Components:**
- [ ] Authentication & Authorization
- [ ] Data Protection & Encryption
- [ ] API Security
- [ ] Session Management
- [ ] Input Validation & XSS
- [ ] CSRF Protection
- [ ] SQL Injection Protection
- [ ] File Upload Security
- [ ] Third-party Integrations
- [ ] Logging & Monitoring
- [ ] GDPR/Privacy Compliance
- [ ] Infrastructure Security
- [ ] Other: ____________

**Data Types at Risk:**
- [ ] User credentials
- [ ] Personal data (PII)
- [ ] Workshop content
- [ ] Payment information
- [ ] API keys/tokens
- [ ] Internal system data
- [ ] Configuration data
- [ ] Other: ____________

## 🔍 Discovery Information

**How was this issue discovered?**
- [ ] Internal security audit
- [ ] External penetration test
- [ ] Bug bounty program
- [ ] User report
- [ ] Automated scanner
- [ ] Code review
- [ ] Production incident
- [ ] Other: ____________

**Environment:**
- [ ] Production
- [ ] Staging
- [ ] Development
- [ ] All environments

## 📋 Vulnerability Details

**Attack Vector:**
- [ ] Network-based
- [ ] Local system
- [ ] Social engineering
- [ ] Insider threat
- [ ] Physical access
- [ ] Other: ____________

**Authentication Required:**
- [ ] No authentication required
- [ ] Basic user account
- [ ] Privileged account
- [ ] Administrative access

**Reproduction Steps:**
Please provide detailed steps to reproduce the security issue.

**Proof of Concept:**
```bash
# Include relevant code snippets, curl commands, or test cases
```

## 🛡️ Technical Details

**Vulnerability Type:**
- [ ] Injection (SQL, NoSQL, OS, LDAP)
- [ ] Broken Authentication
- [ ] Sensitive Data Exposure
- [ ] XML External Entities (XXE)
- [ ] Broken Access Control
- [ ] Security Misconfiguration
- [ ] Cross-Site Scripting (XSS)
- [ ] Insecure Deserialization
- [ ] Using Components with Known Vulnerabilities
- [ ] Insufficient Logging & Monitoring
- [ ] Server-Side Request Forgery (SSRF)
- [ ] Business Logic Flaw
- [ ] Privilege Escalation
- [ ] Information Disclosure
- [ ] Denial of Service (DoS)
- [ ] Cryptographic Weakness
- [ ] Other: ____________

**Affected Code/Files:**
```
src/path/to/vulnerable/file.ts:123
```

**OWASP Top 10 Category:**
- [ ] A01: Broken Access Control
- [ ] A02: Cryptographic Failures
- [ ] A03: Injection
- [ ] A04: Insecure Design
- [ ] A05: Security Misconfiguration
- [ ] A06: Vulnerable and Outdated Components
- [ ] A07: Identification and Authentication Failures
- [ ] A08: Software and Data Integrity Failures
- [ ] A09: Security Logging and Monitoring Failures
- [ ] A10: Server-Side Request Forgery

## 🏥 Remediation

**Immediate Actions Taken:**
- [ ] Vulnerability confirmed
- [ ] Temporary mitigation implemented
- [ ] Affected systems isolated
- [ ] Security team notified
- [ ] Incident response initiated
- [ ] Users notified (if applicable)

**Recommended Fix:**
Please describe the recommended remediation approach.

**Testing Plan:**
- [ ] Unit tests for fix
- [ ] Integration tests
- [ ] Security regression tests
- [ ] Penetration testing validation
- [ ] Performance impact assessment

## 📊 Impact Analysis

**Business Impact:**
- [ ] Financial loss
- [ ] Reputational damage
- [ ] Legal/regulatory penalties
- [ ] Customer trust impact
- [ ] Competitive disadvantage

**User Impact:**
- [ ] Account compromise
- [ ] Data exposure
- [ ] Service disruption
- [ ] Privacy violation
- [ ] Financial loss

**Compliance Impact:**
- [ ] GDPR violation
- [ ] SOX compliance
- [ ] HIPAA compliance
- [ ] PCI DSS violation
- [ ] Other regulations

## 🔗 Related Issues

- Depends on issue #
- Related to security advisory #
- Addresses CVE-____

## 📞 Contact Information

**Reporter Information:**
- Name: [Optional]
- Email: [Optional for follow-up questions]
- Organization: [Optional]

**Security Team Contact:**
- security@workshopsai.com
- Emergency: +1-XXX-XXX-XXXX

## 🚨 Confidentiality

**This security issue should be treated as confidential until:**
- [ ] Public disclosure date
- [ ] Fix is deployed to production
- [ ] Security team approval
- [ ] Vendor coordination complete

## 📎 Supporting Evidence

- [ ] Screenshots
- [ ] Log files
- [ ] Network captures
- [ ] Code snippets
- [ ] Tool output (scanners, etc.)
- [ ] Other evidence

---

## 🤖 Security Swarm Response

This security issue triggers our specialized security swarm coordination:

1. **Immediate Triage**: Security severity assessment within 1 hour
2. **Incident Response**: Automatic security team notification
3. **Vulnerability Analysis**: Deep technical analysis and impact assessment
4. **Remediation Planning**: Security fix development and testing
5. **Compliance Review**: Regulatory impact assessment
6. **Post-Mortem**: Lessons learned and process improvement

**Specialized Security Agents:**
- `security-manager`: Overall security coordination
- `code-analyzer`: Vulnerability code analysis
- `backend-dev`: Secure fix implementation
- `tester`: Security regression testing
- `documentation-specialist`: Security disclosure documentation

**Response SLAs:**
- Critical: 1 hour initial response, 24 hour fix
- High: 4 hour initial response, 72 hour fix
- Medium: 24 hour initial response, 7 day fix
- Low: 72 hour initial response, 14 day fix

**Security Team Escalation**: Automatically triggered for High/Critical severity