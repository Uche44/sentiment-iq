# Taste

- Wants implementation broken into discrete milestones/steps with a test gate run after each one before moving on (test each after implementation). Confidence: 0.7
- Do not create git commits; leave committing to the user even when a spec says to commit at milestone boundaries. Confidence: 0.7
- Prefers the agent to keep working autonomously through the planned steps instead of stopping to ask for approval between milestones ("code away", "move on to 4"). Confidence: 0.7
- When asking an advice/how-to question ("where do I change X?", "what's the simplest way to deploy?"), wants guidance and a recommendation first — explicitly says "dont code"; don't start editing files until they agree. Confidence: 0.6
- Expects renames to be applied everywhere the old name can surface (env vars, config defaults, .env.example, served API values), not just display strings — leaving a surface on the old value prompts "why am I still seeing X?". Confidence: 0.6
