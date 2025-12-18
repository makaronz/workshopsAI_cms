# Agentic Jujutsu Configuration

This directory contains the Agentic Jujutsu configuration for the workshopsAI_cms project.

## Structure

```
.agentic-jujutsu/
├── agent-registry.json      # Registered AI agents
├── workflow-templates.json  # Reusable workflow templates
├── hooks.json              # Integration hooks
├── agent-integration.js    # Example implementation
└── README.md               # This file
```

## Quick Start

1. **Register an Agent**:
   ```javascript
   const integrator = new AgenticJujutsuIntegrator('./');

   await integrator.registerAgent({
       name: 'Code-Generator',
       type: 'coder',
       capabilities: ['coding', 'testing', 'documentation']
   });
   ```

2. **Create a Workflow**:
   ```javascript
   await integrator.createWorkflow({
       name: 'Feature Development',
       description: 'Develop new features with AI assistance',
       agents: ['developer', 'reviewer', 'tester']
   });
   ```

3. **Run AI Workflow Manager**:
   ```bash
   npm run aj:workflow
   ```

## Benefits

- ✅ **23x faster** concurrent operations than Git
- ✅ **87% automatic** conflict resolution
- ✅ **Self-learning** AI that improves over time
- ✅ **Quantum-resistant** security (SHA3-512)
- ✅ **Zero lock** contention for agents
- ✅ **Pattern recognition** for workflow optimization

## Next Steps

1. Review `agent-integration.js` for implementation examples
2. Adapt the code to your agent architecture
3. Start with simple workflows and scale up
4. Monitor learning statistics to optimize performance

## Documentation

See `docs/AGENTIC_JUJUTSU.md` for detailed integration guide.