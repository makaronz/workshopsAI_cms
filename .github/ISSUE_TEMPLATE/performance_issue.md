---
name: Performance Issue
about: Report performance problems or suggest optimizations
title: "[PERFORMANCE] "
labels: ["type:bug", "auto-triage"]
assignees: ''
---

## ⚡ Performance Issue Description

A clear description of the performance problem or optimization opportunity.

## 📊 Performance Metrics

**Current Performance:**
- Response time: _______ ms
- Memory usage: _______ MB
- CPU usage: _______ %
- Database queries: _______
- Concurrent users: _______
- Error rate: _______ %

**Expected Performance:**
- Target response time: _______ ms
- Target memory usage: _______ MB
- Target CPU usage: _______ %
- Target database queries: _______
- Target concurrent users: _______
- Target error rate: <_______ %

**Performance Degradation:**
- [ ] Sudden degradation (specific date/time)
- [ ] Gradual degradation over time
- [ ] Load-related degradation
- [ ] Specific scenario triggers
- [ ] Time-based patterns

## 🎯 Affected Components

**Backend Performance:**
- [ ] API response time
- [ ] Database query performance
- [ ] Memory usage/leaks
- [ ] CPU utilization
- [ ] File I/O operations
- [ ] External API calls
- [ ] Background job processing
- [ ] Cache performance
- [ ] Authentication overhead

**Frontend Performance:**
- [ ] Page load time
- [ ] JavaScript execution
- [ ] Rendering performance
- [ ] Bundle size
- [ ] Asset optimization
- [ ] Network requests
- [ ] Client-side caching
- [ ] Memory usage in browser
- [ ] Mobile performance

**Database Performance:**
- [ ] Query execution time
- [ ] Index optimization
- [ ] Connection pooling
- [ ] Memory allocation
- [ ] Disk I/O performance
- [ ] Lock contention
- [ ] Query optimization
- [ ] Database schema design

**Infrastructure Performance:**
- [ ] Server response time
- [ ] Network latency
- [ ] CDN performance
- [ ] Load balancing
- [ ] Auto-scaling behavior
- [ ] Container performance
- [ ] Storage I/O

## 🔍 Reproduction Steps

Please provide detailed steps to reproduce the performance issue:

1. **Setup**: What data/state is required
2. **Actions**: Specific steps to trigger the issue
3. **Load Conditions**: Number of users, data volume, etc.
4. **Environment**: Development/staging/production

## 📈 Performance Analysis

**When does the issue occur?**
- [ ] During peak usage hours
- [ ] With large datasets
- [ ] Specific user actions
- [ ] Under load testing
- [ ] With specific configurations
- [ ] After recent deployments
- [ ] During data imports/exports

**Load Testing Results:**
```bash
# Include k6, JMeter, or other load testing results
```

**Profiling Data:**
```bash
# Include CPU/memory profiling, flame graphs, etc.
```

**Database Analysis:**
```sql
-- Include slow query logs, execution plans, etc.
```

## 🛠️ Optimization Suggestions

**Code Optimizations:**
- [ ] Algorithm improvements
- [ ] Caching strategies
- [ ] Query optimization
- [ ] Memory management
- [ ] Async/await optimization
- [ ] Bundle splitting
- [ ] Lazy loading
- [ ] Code splitting

**Infrastructure Optimizations:**
- [ ] Database indexing
- [ ] CDN configuration
- [ ] Load balancing
- [ ] Auto-scaling rules
- [ ] Memory/CPU allocation
- [ ] Network optimization
- [ ] Storage optimization
- [ ] Caching layers

**Architecture Improvements:**
- [ ] Microservices decomposition
- [ ] Event-driven architecture
- [ ] Message queuing
- [ ] Database sharding
- [ ] Read replicas
- [ ] Edge computing
- [ ] Serverless optimization

## 📋 Implementation Priority

**Business Impact:**
- [ ] Critical - affecting all users
- [ ] High - affecting many users
- [ ] Medium - affecting specific features
- [ ] Low - minor performance improvements

**Effort Estimation:**
- [ ] Quick win (<1 day)
- [ ] Small (1-3 days)
- [ ] Medium (1-2 weeks)
- [ ] Large (2-4 weeks)
- [ ] Very Large (>1 month)

**Expected ROI:**
- [ ] User experience improvement
- [ ] Infrastructure cost reduction
- [ ] Scalability improvement
- [ ] Competitive advantage
- [ ] Developer productivity

## 🔗 Dependencies

**Blocks:**
- Depends on issue #
- Required for issue #
- Related to optimization sprint

**External Dependencies:**
- [ ] Third-party APIs
- [ ] CDN providers
- [ ] Database vendors
- [ ] Cloud providers
- [ ] Monitoring tools

## 📊 Success Metrics

**Performance KPIs:**
- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms
- [ ] Database query time < 100ms
- [ ] Memory usage reduction by ___%
- [ ] CPU usage reduction by ___%
- [ ] Error rate < 0.1%
- [ ] Concurrent user support: ___ users

**Business KPIs:**
- [ ] User satisfaction score
- [ ] Conversion rate improvement
- [ ] Bounce rate reduction
- [ ] Support ticket reduction
- [ ] Revenue impact

## 🧪 Testing Strategy

**Performance Testing:**
- [ ] Load testing plan
- [ ] Stress testing
- [ ] Spike testing
- [ ] Endurance testing
- [ ] Volume testing
- [ ] Scalability testing

**Monitoring Setup:**
- [ ] APM integration (New Relic, DataDog)
- [ ] Custom metrics dashboard
- [ ] Alert configuration
- [ ] Performance budgets
- [ ] Regression testing

## 📎 Supporting Data

**Performance Reports:**
- [ ] Load test results
- [ ] Database slow query log
- [ ] Memory profiling data
- [ ] CPU utilization graphs
- [ ] Network latency reports
- [ ] User experience metrics

**Code Analysis:**
- [ ] Code profiling data
- [ ] Bundle analysis reports
- [ ] Lighthouse audits
- [ ] WebPageTest results
- [ ] Application logs

---

## 🤖 Performance Swarm Analysis

This performance issue will be analyzed by our specialized performance swarm:

1. **Performance Profiling**: Deep dive into performance bottlenecks
2. **Architecture Review**: System design optimization opportunities
3. **Resource Analysis**: Infrastructure and resource utilization
4. **Benchmark Testing**: Performance testing and validation
5. **Optimization Planning**: Prioritized improvement roadmap

**Specialized Performance Agents:**
- `perf-analyzer`: Performance bottleneck identification
- `performance-benchmarker`: Testing and benchmarking
- `performance-optimizer`: Optimization implementation
- `system-architect`: Architecture improvements
- `backend-dev`: Backend performance fixes
- `frontend-dev`: Frontend optimization

**Performance Optimization Process:**
1. Baseline measurement
2. Bottleneck identification
3. Solution development
4. Performance testing
5. Production deployment
6. Monitoring and validation

**Expected Analysis Time**: 24-48 hours for complex issues, 4-8 hours for straightforward optimizations