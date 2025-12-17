#!/usr/bin/env node

/**
 * Integration script for adding Agentic Jujutsu to existing projects
 *
 * This script shows how to integrate Agentic Jujutsu into your current
 * AI agent workflows for enhanced coordination and learning.
 */

const fs = require('fs').promises;
const path = require('path');

class AgenticJujutsuIntegrator {
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.configPath = path.join(projectPath, '.agentic-jujutsu');
    }

    /**
     * Initialize Agentic Jujutsu in the project
     */
    async initialize() {
        console.log('🔧 Initializing Agentic Jujutsu integration...\n');

        // Create configuration directory
        await fs.mkdir(this.configPath, { recursive: true });

        // Create agent registry
        const agentRegistry = {
            version: '1.0.0',
            agents: [],
            workflows: [],
            settings: {
                autoLearning: true,
                conflictResolution: 'auto',
                encryption: true,
                quantumSecurity: true
            }
        };

        await fs.writeFile(
            path.join(this.configPath, 'agent-registry.json'),
            JSON.stringify(agentRegistry, null, 2)
        );

        // Create workflow templates
        const templates = {
            featureDevelopment: {
                name: 'Feature Development',
                agents: ['developer', 'reviewer', 'tester'],
                stages: [
                    { name: 'analysis', agent: 'developer' },
                    { name: 'implementation', agent: 'developer' },
                    { name: 'review', agent: 'reviewer' },
                    { name: 'testing', agent: 'tester' },
                    { name: 'deployment', agent: 'devops' }
                ]
            },
            bugFix: {
                name: 'Bug Fix',
                agents: ['developer', 'tester'],
                stages: [
                    { name: 'investigation', agent: 'developer' },
                    { name: 'fix', agent: 'developer' },
                    { name: 'verification', agent: 'tester' }
                ]
            },
            codeReview: {
                name: 'Code Review',
                agents: ['reviewer', 'security'],
                stages: [
                    { name: 'automated-checks', agent: 'reviewer' },
                    { name: 'security-scan', agent: 'security' },
                    { name: 'manual-review', agent: 'reviewer' }
                ]
            }
        };

        await fs.writeFile(
            path.join(this.configPath, 'workflow-templates.json'),
            JSON.stringify(templates, null, 2)
        );

        // Create hooks configuration
        const hooks = {
            preTask: [
                'npx agentic-jujutsu hooks pre-task --description "$DESCRIPTION"',
                'npx agentic-jujutsu hooks session-restore'
            ],
            postEdit: [
                'npx agentic-jujutsu hooks post-edit --file "$FILE"',
                'npx agentic-jujutsu hooks notify --message "Modified $FILE"'
            ],
            postTask: [
                'npx agentic-jujutsu hooks post-task --task-id "$TASK_ID"',
                'npx agentic-jujutsu hooks memory-sync'
            ]
        };

        await fs.writeFile(
            path.join(this.configPath, 'hooks.json'),
            JSON.stringify(hooks, null, 2)
        );

        console.log('✅ Agentic Jujutsu initialized successfully!');
        console.log('   Configuration created in: .agentic-jujutsu/');

        return true;
    }

    /**
     * Register an AI agent
     */
    async registerAgent(config) {
        const registryPath = path.join(this.configPath, 'agent-registry.json');
        const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));

        const agent = {
            id: `agent_${Date.now()}`,
            name: config.name,
            type: config.type || 'general',
            capabilities: config.capabilities || [],
            version: config.version || '1.0.0',
            registeredAt: new Date().toISOString(),
            trajectoryCount: 0,
            successRate: 1.0,
            preferredPatterns: []
        };

        registry.agents.push(agent);
        await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));

        console.log(`✅ Registered agent: ${agent.name} (${agent.type})`);
        console.log(`   Capabilities: ${agent.capabilities.join(', ') || 'none specified'}`);

        return agent;
    }

    /**
     * Create a new workflow
     */
    async createWorkflow(config) {
        const registryPath = path.join(this.configPath, 'agent-registry.json');
        const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));

        const workflow = {
            id: `workflow_${Date.now()}`,
            name: config.name,
            description: config.description,
            template: config.template || 'custom',
            agents: config.agents || [],
            status: 'created',
            createdAt: new Date().toISOString(),
            trajectories: []
        };

        registry.workflows.push(workflow);
        await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));

        console.log(`✅ Created workflow: ${workflow.name}`);
        console.log(`   Agents: ${workflow.agents.join(', ') || 'none assigned'}`);

        return workflow;
    }

    /**
     * Generate integration code
     */
    async generateIntegrationCode() {
        const code = `// Agentic Jujutsu Integration Code
// Add this to your AI agent implementation

const { JjWrapper } = require('agentic-jujutsu');

class AIAgent {
    constructor(name, capabilities = []) {
        this.name = name;
        this.capabilities = capabilities;
        this.jj = new JjWrapper();
        this.trajectoryCount = 0;
    }

    async startTask(taskDescription) {
        console.log(\`🤖 \${this.name}: Starting \${taskDescription}\`);

        // Start learning trajectory
        const trajectoryId = this.jj.startTrajectory(taskDescription);

        // Get AI suggestion based on past experience
        const suggestion = JSON.parse(this.jj.getSuggestion(taskDescription));

        console.log(\`   Confidence: \${(suggestion.confidence * 100).toFixed(1)}%\`);
        console.log(\`   Reasoning: \${suggestion.reasoning}\`);

        return {
            trajectoryId,
            suggestion,
            confidence: suggestion.confidence
        };
    }

    async executeOperation(operation) {
        // Execute the operation
        console.log(\`   Executing: \${operation}\`);

        // Simulate operation execution
        const success = Math.random() > 0.2; // 80% success rate

        // In real implementation, this would be your actual operation
        const result = await this.performOperation(operation);

        // Record operation to trajectory
        this.jj.addToTrajectory();

        return { success, result };
    }

    async completeTask(trajectoryId, successScore, critique = '') {
        // Finalize trajectory with learning
        this.jj.finalizeTrajectory(successScore, critique);

        console.log(\`✅ \${this.name}: Task completed\`);
        console.log(\`   Success: \${(successScore * 100).toFixed(1)}%\`);
        console.log(\`   Critique: \${critique || 'No critique provided'}\`);

        this.trajectoryCount++;

        // Get updated learning statistics
        const stats = JSON.parse(this.jj.getLearningStats());
        console.log(\`   Total trajectories: \${stats.totalTrajectories}\`);
        console.log(\`   Improvement rate: \${(stats.improvementRate * 100).toFixed(1)}%\`);
    }

    async performOperation(operation) {
        // Implement your actual operation logic here
        // This is where your AI agent does its work

        switch (operation) {
            case 'analyze':
                return await this.analyze();
            case 'implement':
                return await this.implement();
            case 'test':
                return await this.test();
            case 'review':
                return await this.review();
            default:
                return await this.customOperation(operation);
        }
    }

    // Implement your agent-specific methods
    async analyze() {
        // Analysis logic
        return { analysis: 'completed' };
    }

    async implement() {
        // Implementation logic
        return { implementation: 'completed' };
    }

    async test() {
        // Testing logic
        return { tests: 'passed' };
    }

    async review() {
        // Review logic
        return { review: 'approved' };
    }

    async customOperation(op) {
        // Custom operation logic
        return { [op]: 'completed' };
    }
}

// Usage example:
const agent = new AIAgent('Code-Generator', ['coding', 'testing']);

// Start a task
const { trajectoryId, suggestion, confidence } = await agent.startTask('Generate REST API');

// Execute operations based on suggestion
for (const operation of suggestion.recommendedOperations) {
    await agent.executeOperation(operation);
}

// Complete the task
await agent.completeTask(trajectoryId, 0.9, 'Generated clean, tested API code');

// The agent learns from this experience and will improve suggestions for future tasks
`;

        const outputPath = path.join(this.configPath, 'agent-integration.js');
        await fs.writeFile(outputPath, code);

        console.log(`✅ Integration code generated: ${outputPath}`);
        return outputPath;
    }

    /**
     * Create package.json scripts
     */
    async addPackageScripts() {
        const packageJsonPath = path.join(this.projectPath, 'package.json');

        try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

            packageJson.scripts = {
                ...packageJson.scripts,
                'aj:init': 'node scripts/integrate-with-agentic-jujutsu.js',
                'aj:workflow': 'node scripts/ai-workflow-manager.js',
                'aj:agents': 'node .agentic-jujutsu/list-agents.js',
                'aj:status': 'npx agentic-jujutsu status',
                'aj:log': 'npx agentic-jujutsu log --limit 10'
            };

            await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

            console.log('✅ Added npm scripts for Agentic Jujutsu');
            console.log('   Run: npm run aj:init - to initialize');
            console.log('   Run: npm run aj:workflow - to manage workflows');

        } catch (error) {
            console.log('⚠️  Could not update package.json');
            console.log('   Ensure it exists and has valid JSON');
        }
    }

    /**
     * Generate documentation
     */
    async generateDocs() {
        const docs = `# Agentic Jujutsu Integration

This project has been configured with Agentic Jujutsu for AI agent version control and coordination.

## Quick Start

### 1. Initialize the system
\`\`\`bash
npm run aj:init
\`\`\`

### 2. Register your AI agents
\`\`\`javascript
const integrator = new AgenticJujutsuIntegrator('./');

await integrator.registerAgent({
    name: 'Code-Generator',
    type: 'coder',
    capabilities: ['coding', 'testing', 'documentation']
});
\`\`\`

### 3. Create workflows
\`\`\`javascript
await integrator.createWorkflow({
    name: 'Feature Development',
    description: 'Develop new features with AI assistance',
    agents: ['developer', 'reviewer', 'tester']
});
\`\`\`

## Benefits

- ✅ **23x faster** concurrent operations than Git
- ✅ **87% automatic** conflict resolution
- ✅ **Self-learning** AI that improves over time
- ✅ **Quantum-resistant** security (SHA3-512)
- ✅ **Zero lock** contention for agents
- ✅ **Pattern recognition** for workflow optimization

## Integration Points

### In Your AI Agent Code
1. Import JjWrapper from 'agentic-jujutsu'
2. Start trajectories for tasks
3. Record operations with addToTrajectory()
4. Finalize with success scores for learning

### Hook Integration
- Pre-task: Initialize context and restore sessions
- Post-edit: Track file changes and notify agents
- Post-task: Save learning data and sync memory

## Configuration

Configuration is stored in \`.agentic-jujutsu/\`:
- \`agent-registry.json\` - Agent definitions
- \`workflow-templates.json\` - Reusable workflows
- \`hooks.json\` - Integration hooks
- \`agent-integration.js\` - Example implementation

## Next Steps

1. Review the generated integration code
2. Adapt it to your agent architecture
3. Start with simple workflows
4. Scale up to complex multi-agent coordination

For more information, see:
- https://npmjs.com/package/agentic-jujutsu
- https://github.com/ruvnet/agentic-flow
`;

        const docsPath = path.join(this.projectPath, 'docs', 'AGENTIC_JUJUTSU.md');
        await fs.mkdir(path.dirname(docsPath), { recursive: true });
        await fs.writeFile(docsPath, docs);

        console.log(`✅ Documentation created: ${docsPath}`);
        return docsPath;
    }
}

// Main execution
async function main() {
    console.log('🚀 Agentic Jujutsu Project Integration\n');

    const integrator = new AgenticJujutsuIntegrator(process.cwd());

    // Initialize the project
    await integrator.initialize();

    // Register example agents
    await integrator.registerAgent({
        name: 'Code-Generator',
        type: 'coder',
        capabilities: ['coding', 'testing', 'documentation']
    });

    await integrator.registerAgent({
        name: 'Security-Auditor',
        type: 'reviewer',
        capabilities: ['security', 'code-review', 'compliance']
    });

    await integrator.registerAgent({
        name: 'Test-Generator',
        type: 'tester',
        capabilities: ['unit-testing', 'integration-testing', 'e2e-testing']
    });

    // Create example workflow
    await integrator.createWorkflow({
        name: 'Secure Feature Development',
        description: 'Develop new features with security and testing',
        agents: ['Code-Generator', 'Security-Auditor', 'Test-Generator']
    });

    // Generate integration resources
    await integrator.generateIntegrationCode();
    await integrator.addPackageScripts();
    await integrator.generateDocs();

    console.log('\n✅ Integration complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run aj:workflow - to see workflow management in action');
    console.log('2. Check: .agentic-jujutsu/ - for configuration');
    console.log('3. Read: docs/AGENTIC_JUJUTSU.md - for detailed guide');
    console.log('4. Adapt: .agentic-jujutsu/agent-integration.js - to your needs');
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { AgenticJujutsuIntegrator };