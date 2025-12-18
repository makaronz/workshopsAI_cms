# Agentic Jujutsu Integration

This project has been configured with Agentic Jujutsu for AI agent version control and coordination.

## Quick Start

### 1. Initialize the system
```bash
npm run aj:init
```

### 2. Register your AI agents
```javascript
const integrator = new AgenticJujutsuIntegrator('./');

await integrator.registerAgent({
    name: 'Code-Generator',
    type: 'coder',
    capabilities: ['coding', 'testing', 'documentation']
});
```

### 3. Create workflows
```javascript
await integrator.createWorkflow({
    name: 'Feature Development',
    description: 'Develop new features with AI assistance',
    agents: ['developer', 'reviewer', 'tester']
});
```

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

Configuration is stored in `.agentic-jujutsu/`:
- `agent-registry.json` - Agent definitions
- `workflow-templates.json` - Reusable workflows
- `hooks.json` - Integration hooks
- `agent-integration.js` - Example implementation

## Next Steps

1. Review the generated integration code
2. Adapt it to your agent architecture
3. Start with simple workflows
4. Scale up to complex multi-agent coordination

For more information, see:
- https://npmjs.com/package/agentic-jujutsu
- https://github.com/ruvnet/agentic-flow
