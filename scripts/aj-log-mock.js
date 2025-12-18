#!/usr/bin/env node

/**
 * Mock Agentic Jujutsu Log Command
 *
 * Displays workflow and trajectory history
 */

const fs = require('fs').promises;
const path = require('path');

async function showLog(limit = 10) {
    console.log('📜 Agentic Jujutsu Log\n');

    try {
        // Read learning data
        const learningDataPath = path.join(process.cwd(), 'learning-data.json');
        const learningExists = await fs.access(learningDataPath).then(() => true).catch(() => false);

        if (learningExists) {
            const learning = JSON.parse(await fs.readFile(learningDataPath, 'utf8'));

            console.log(`📊 Recent Workflows (showing last ${Math.min(limit, learning.workflows.length)}):\n`);

            learning.workflows
                .slice(-limit)
                .reverse()
                .forEach((workflow, index) => {
                    const duration = workflow.duration ? `${workflow.duration}ms` : 'N/A';
                    const successRate = workflow.successRate ? `${(workflow.successRate * 100).toFixed(1)}%` : 'N/A';

                    console.log(`${index + 1}. ${workflow.description}`);
                    console.log(`   Duration: ${duration} | Success Rate: ${successRate}`);

                    if (workflow.agents && workflow.agents.length > 0) {
                        console.log(`   Agents: ${workflow.agents.join(', ')}`);
                    }
                    console.log('');
                });
        } else {
            console.log('📝 No workflow history found');
            console.log('   Run some workflows first with: npm run aj:workflow');
        }

        // Read agent registry for trajectory info
        const registryPath = path.join(process.cwd(), '.agentic-jujutsu', 'agent-registry.json');
        const registryExists = await fs.access(registryPath).then(() => true).catch(() => false);

        if (registryExists) {
            const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));

            console.log('🤖 Agent Trajectories:\n');

            registry.agents
                .filter(agent => agent.trajectoryCount > 0)
                .forEach(agent => {
                    console.log(`• ${agent.name}:`);
                    console.log(`  Trajectories: ${agent.trajectoryCount}`);
                    console.log(`  Success Rate: ${(agent.successRate * 100).toFixed(1)}%`);
                    console.log(`  Capabilities: ${agent.capabilities.join(', ') || 'none'}`);
                    console.log('');
                });
        }

    } catch (error) {
        console.error('❌ Error reading log:', error.message);
    }
}

const limit = process.argv[2] ? parseInt(process.argv[2]) : 10;
showLog(limit).catch(console.error);