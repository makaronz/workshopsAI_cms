#!/usr/bin/env node

const { JjWrapper } = require('agentic-jujutsu');

async function main() {
    console.log('🚀 Initializing Agentic Jujutsu Demo...\n');

    // Create wrapper instance
    const jj = new JjWrapper();

    try {
        // Check repository status
        console.log('📊 Repository Status:');
        const status = await jj.status();
        console.log(JSON.stringify(status, null, 2));

        console.log('\n📝 Recent Commit History:');
        const commits = await jj.log(5);
        commits.forEach(commit => {
            console.log(`  ${commit.commitId.substring(0,8)} ${commit.message}`);
        });

        // Start self-learning trajectory
        console.log('\n🧠 Starting Self-Learning Trajectory:');
        const trajectoryId = jj.startTrajectory('Implement Agentic Jujutsu demonstration');
        console.log(`  Trajectory ID: ${trajectoryId}`);

        // Perform some operations
        console.log('\n⚡ Performing operations:');

        // Create a demo branch
        const branchResult = await jj.branchCreate('demo/agentic-jujutsu');
        console.log(`  Branch creation: ${branchResult.success ? '✅' : '❌'}`);

        // Get current stats
        const stats = JSON.parse(jj.getStats());
        console.log(`  Total operations: ${stats.total_operations}`);
        console.log(`  Success rate: ${(stats.success_rate * 100).toFixed(1)}%`);

        // Add operations to trajectory
        jj.addToTrajectory();

        // Get AI suggestion
        console.log('\n🤖 AI Suggestion for "Create tutorial documentation":');
        const suggestion = JSON.parse(jj.getSuggestion('Create tutorial documentation'));
        console.log(`  Confidence: ${(suggestion.confidence * 100).toFixed(1)}%`);
        console.log(`  Reasoning: ${suggestion.reasoning}`);
        console.log(`  Expected success: ${(suggestion.expectedSuccessRate * 100).toFixed(1)}%`);

        if (suggestion.recommendedOperations && suggestion.recommendedOperations.length > 0) {
            console.log('  Recommended operations:');
            suggestion.recommendedOperations.forEach(op => console.log(`    - ${op}`));
        }

        // Finalize trajectory
        jj.finalizeTrajectory(0.9, 'Successfully demonstrated Agentic Jujutsu features');

        // Get learning statistics
        console.log('\n📊 Learning Statistics:');
        const learningStats = JSON.parse(jj.getLearningStats());
        console.log(`  Total trajectories: ${learningStats.totalTrajectories}`);
        console.log(`  Patterns discovered: ${learningStats.totalPatterns}`);
        console.log(`  Average success: ${(learningStats.avgSuccessRate * 100).toFixed(1)}%`);
        console.log(`  Prediction accuracy: ${(learningStats.predictionAccuracy * 100).toFixed(1)}%`);

        // Get discovered patterns
        console.log('\n🔍 Discovered Patterns:');
        const patterns = JSON.parse(jj.getPatterns());
        patterns.forEach(pattern => {
            console.log(`  Pattern: ${pattern.name || 'Unnamed'}`);
            console.log(`    Success rate: ${(pattern.successRate * 100).toFixed(1)}%`);
            console.log(`    Usage count: ${pattern.observationCount}`);
            if (pattern.operationSequence && pattern.operationSequence.length > 0) {
                console.log(`    Sequence: ${pattern.operationSequence.join(' → ')}`);
            }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };