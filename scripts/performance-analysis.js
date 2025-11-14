const { performance } = require('perf_hooks');
const http = require('http');

class PerformanceAnalyzer {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.results = {
      endpoints: {},
      system: {},
      database: {},
      cache: {},
      summary: {}
    };
  }

  async analyzeEndpoint(endpoint, options = {}) {
    const {
      method = 'GET',
      payload = null,
      headers = {},
      iterations = 10
    } = options;

    console.log('Analyzing endpoint: ' + method + ' ' + endpoint);
    
    const times = [];
    const errors = [];
    const promises = [];

    for (let i = 0; i < iterations; i++) {
      promises.push(this.makeRequest(method, endpoint, payload, headers));
    }

    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        times.push(result.value.time);
        if (!result.value.success) {
          errors.push(result.value.error);
        }
      } else {
        errors.push(result.reason);
      }
    });

    const sortedTimes = times.sort((a, b) => a - b);
    
    return {
      endpoint: endpoint,
      method: method,
      iterations: iterations,
      successful: times.length,
      errors: errors.length,
      average: this.average(times),
      median: this.median(sortedTimes),
      p95: this.percentile(sortedTimes, 95),
      p99: this.percentile(sortedTimes, 99),
      min: Math.min(...times),
      max: Math.max(...times),
      errorRate: (errors.length / iterations) * 100
    };
  }

  async makeRequest(method, endpoint, payload, headers) {
    const url = this.baseUrl + endpoint;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const requestOptions = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'performance-analyzer',
          ...headers
        },
        timeout: 10000
      };

      const req = http.request(url, requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            time: responseTime,
            size: data.length
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        resolve({
          success: false,
          error: error.message,
          time: endTime - startTime
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout',
          time: 10000
        });
      });

      if (payload) {
        req.write(JSON.stringify(payload));
      }
      
      req.end();
    });
  }

  async runFullAnalysis() {
    console.log('Starting comprehensive performance analysis...');
    const analysisStartTime = performance.now();

    // Analyze key endpoints
    const endpoints = [
      { path: '/health', method: 'GET' },
      { path: '/metrics', method: 'GET' },
      { path: '/api/v1/workshops', method: 'GET' },
      { path: '/api/v1/public/workshops', method: 'GET' }
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await this.analyzeEndpoint(endpoint.path, {
          method: endpoint.method,
          iterations: 20
        });
        this.results.endpoints[endpoint.path] = result;
      } catch (error) {
        this.results.endpoints[endpoint.path] = { error: error.message };
      }
    }

    const analysisEndTime = performance.now();
    this.results.summary.analysisTime = analysisEndTime - analysisStartTime;
    this.results.summary.timestamp = new Date().toISOString();

    this.generateSummary();
  }

  generateSummary() {
    const endpoints = Object.values(this.results.endpoints);
    const successfulEndpoints = endpoints.filter(ep => ep && !ep.error);
    
    if (successfulEndpoints.length > 0) {
      const avgResponseTimes = successfulEndpoints.map(ep => ep.average);
      const p95ResponseTimes = successfulEndpoints.map(ep => ep.p95);
      const errorRates = successfulEndpoints.map(ep => ep.errorRate);

      this.results.summary.performance = {
        averageResponseTime: this.average(avgResponseTimes),
        p95ResponseTime: this.average(p95ResponseTimes),
        averageErrorRate: this.average(errorRates),
        totalEndpoints: endpoints.length,
        successfulEndpoints: successfulEndpoints.length
      };
    }
  }

  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  median(arr) {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  percentile(arr, p) {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[index] || 0;
  }

  printReport() {
    console.log('\n=== PERFORMANCE ANALYSIS REPORT ===');
    console.log('Analysis Date: ' + this.results.summary.timestamp);
    console.log('Analysis Duration: ' + this.results.summary.analysisTime.toFixed(2) + 'ms');
    
    console.log('\n--- ENDPOINT PERFORMANCE ---');
    Object.entries(this.results.endpoints).forEach(([endpoint, data]) => {
      if (data.error) {
        console.log(endpoint + ': ERROR - ' + data.error);
      } else {
        console.log(endpoint + ': ' + data.average.toFixed(2) + 'ms avg, ' + 
                   data.p95.toFixed(2) + 'ms P95, ' + data.errorRate.toFixed(2) + '% errors');
      }
    });

    console.log('\n--- SUMMARY ---');
    const performance = this.results.summary.performance;
    if (performance) {
      console.log('Overall P95 Response Time: ' + performance.p95ResponseTime.toFixed(2) + 'ms');
      console.log('Overall Error Rate: ' + performance.averageErrorRate.toFixed(2) + '%');
      
      const responseTimeTargetMet = performance.p95ResponseTime < 400;
      const errorRateTargetMet = performance.averageErrorRate < 5;
      
      console.log('Response Time Target Met: ' + (responseTimeTargetMet ? '✅' : '❌'));
      console.log('Error Rate Target Met: ' + (errorRateTargetMet ? '✅' : '❌'));
    }
  }
}

// Run analysis if this file is executed directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3001';
  const analyzer = new PerformanceAnalyzer(baseUrl);
  
  analyzer.runFullAnalysis()
    .then(() => {
      analyzer.printReport();
    })
    .catch(error => {
      console.error('Performance analysis failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceAnalyzer;
