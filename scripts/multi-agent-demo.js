#!/usr/bin/env node

const { JjWrapper } = require('agentic-jujutsu');

class SelfImprovingAgent {
    constructor(name) {
        this.name = name;
        this.jj = new JjWrapper();
        this.trajectoryCount = 0;
    }

    async performTask(taskDescription) {
        console.log(`\n🤖 ${this.name}: Starting task - ${taskDescription}`);

        // Get AI suggestion based on learning
        const suggestion = JSON.parse(this.jj.getSuggestion(taskDescription));

        console.log(`  AI Confidence: ${(suggestion.confidence * 100).toFixed(1)}%`);
        console.log(`  Expected Success: ${(suggestion.expectedSuccessRate * 100).toFixed(1)}%`);

        if (suggestion.reasoning) {
            console.log(`  Reasoning: ${suggestion.reasoning}`);
        }

        // Start learning trajectory
        this.jj.startTrajectory(taskDescription);
        this.trajectoryCount++;

        // Simulate task execution
        const startTime = Date.now();
        let success = false;
        let critique = '';

        try {
            // Simulate different success rates based on confidence
            const successProbability = suggestion.confidence || 0.5;
            const random = Math.random();

            if (random < successProbability) {
                success = true;
                critique = `Completed successfully using learned patterns (${Date.now() - startTime}ms)`;
            } else {
                success = false;
                critique = `Task failed - need more practice with this type of operation`;
            }

            // Add some delay to simulate real work
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

        } catch (err) {
            success = false;
            critique = `Error occurred: ${err.message}`;
        }

        // Record learning outcome
        this.jj.addToTrajectory();
        this.jj.finalizeTrajectory(success ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3, critique);

        console.log(`  Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`  Critique: ${critique}`);

        return success;
    }

    getAgentStats() {
        const stats = JSON.parse(this.jj.getLearningStats());
        return {
            name: this.name,
            trajectories: this.trajectoryCount,
            avgSuccess: stats.avgSuccessRate,
            improvement: stats.improvementRate,
            predictionAccuracy: stats.predictionAccuracy
        };
    }
}

async function demonstrateMultiAgentCoordination() {
    console.log('🚀 Multi-Agent Coordination Demo\n');

    // Create multiple agents
    const agents = [
        new SelfImprovingAgent('Coder-Agent'),
        new SelfImprovingAgent('Reviewer-Agent'),
        new SelfImprovingAgent('Tester-Agent'),
        new SelfImprovingAgent('Deployer-Agent')
    ];

    // Task list for agents to work on
    const tasks = [
        'Implement authentication module',
        'Review code quality',
        'Write unit tests',
        'Deploy to staging',
        'Fix UI bug',
        'Optimize database query',
        'Update documentation',
        'Refactor legacy code'
    ];

    console.log(`📋 Assigning ${tasks.length} tasks to ${agents.length} agents...\n`);

    // Let agents work on tasks concurrently (no locks needed!)
    const results = await Promise.all(
        agents.map(async (agent, agentIndex) => {
            const agentTasks = tasks.filter((_, i) => i % agents.length === agentIndex);
            const agentResults = [];

            for (const task of agentTasks) {
                const success = await agent.performTask(task);
                agentResults.push({ task, success });
            }

            return {
                agent: agent.name,
                results: agentResults,
                stats: agent.getAgentStats()
            };
        })
    );

    // Display results
    console.log('\n📊 Agent Performance Summary:');
    results.forEach(result => {
        const { agent, results: taskResults, stats } = result;
        const successCount = taskResults.filter(r => r.success).length;

        console.log(`\n  ${agent}:`);
        console.log(`    Tasks completed: ${successCount}/${taskResults.length}`);
        console.log(`    Average success rate: ${(stats.avgSuccess * 100).toFixed(1)}%`);
        console.log(`    Improvement rate: ${(stats.improvement * 100).toFixed(1)}%`);
        console.log(`    Prediction accuracy: ${(stats.predictionAccuracy * 100).toFixed(1)}%`);
    });

    // Query patterns across all agents
    console.log('\n🔍 Cross-Agent Pattern Analysis:');
    const mainJJ = new JjWrapper();
    const patterns = JSON.parse(mainJJ.getPatterns());

    if (patterns.length > 0) {
        patterns.slice(0, 3).forEach((pattern, i) => {
            console.log(`\n  Pattern ${i + 1}:`);
            console.log(`    Success rate: ${(pattern.successRate * 100).toFixed(1)}%`);
            console.log(`    Used ${pattern.observationCount} times`);
            if (pattern.operationSequence) {
                console.log(`    Workflow: ${pattern.operationSequence.join(' → ')}`);
            }
        });
    } else {
        console.log('  No patterns discovered yet - need more trajectories');
    }
}

if (require.main === module) {
    demonstrateMultiAgentCoordination().catch(console.error);
}

module.exports = { SelfImprovingAgent, demonstrateMultiAgentCoordination };