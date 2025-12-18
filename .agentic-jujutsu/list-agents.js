#!/usr/bin/env node

/**
 * List registered AI agents
 */

const fs = require('fs').promises;
const path = require('path');

async function listAgents() {
    console.log('🤖 Registered AI Agents\n');

    try {
        const registryPath = path.join(process.cwd(), '.agentic-jujutsu', 'agent-registry.json');
        const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));

        if (registry.agents.length === 0) {
            console.log('No agents registered yet.');
            console.log('Run: npm run aj:init to register default agents');
            return;
        }

        console.log(`Total agents: ${registry.agents.length}\n`);

        registry.agents.forEach((agent, index) => {
            console.log(`${index + 1}. ${agent.name}`);
            console.log(`   Type: ${agent.type}`);
            console.log(`   Capabilities: ${agent.capabilities.join(', ') || 'none'}`);
            console.log(`   Trajectories: ${agent.trajectoryCount}`);
            console.log(`   Success Rate: ${(agent.successRate * 100).toFixed(1)}%`);
            console.log(`   Version: ${agent.version}`);
            console.log(`   Registered: ${new Date(agent.registeredAt).toLocaleDateString()}`);
            console.log('');
        });

        // Show available workflows
        const templatesPath = path.join(process.cwd(), '.agentic-jujutsu', 'workflow-templates.json');
        const templatesExists = await fs.access(templatesPath).then(() => true).catch(() => false);

        if (templatesExists) {
            const templates = JSON.parse(await fs.readFile(templatesPath, 'utf8'));

            console.log('📋 Available Workflow Templates:\n');
            Object.keys(templates).forEach(key => {
                const template = templates[key];
                console.log(`• ${template.name}`);
                console.log(`  Agents: ${template.agents.join(', ')}`);
                console.log(`  Stages: ${template.stages.length} phases`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('❌ Error reading agents:', error.message);
        console.log('Make sure to run: npm run aj:init');
    }
}

listAgents().catch(console.error);