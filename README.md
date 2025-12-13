# Agentic UI Prototype

A prototype demonstrating AI-controllable UI architecture with state machines.

## Architecture

```
Claude Code <--stdio--> MCP Server <--WebSocket--> Vue Frontend
                            |
                        XState Machine
                        (holds state)
```

## Quick Start

### 1. Install Dependencies

```bash
# From the research project root
bun install

# Or install individually
cd packages/agentic-ui-prototype/mcp-server && bun install
cd packages/agentic-ui-prototype/frontend && bun install
```

### 2. Start the Frontend

```bash
cd packages/agentic-ui-prototype/frontend
bun run dev
# Opens at http://localhost:3000
```

### 3. Add MCP Server to Claude Code

Add to your Claude Code MCP settings (`~/.claude.json` or project settings):

```json
{
  "mcpServers": {
    "agentic-ui": {
      "command": "bun",
      "args": ["run", "/path/to/packages/agentic-ui-prototype/mcp-server/src/index.ts"]
    }
  }
}
```

### 4. Restart Claude Code

After adding the MCP server config, restart Claude Code to load the new tools.

## Usage

Once connected, ask Claude to interact with the UI:

- "Set the text to 'Hello World'"
- "Append ' - from Claude' to the text"
- "Clear the text"
- "Undo that change"
- "What's the current state of the UI?"

## MCP Tools

### `get_app_info`
Returns information about what the app does and its capabilities.

### `get_current_state`
Returns the current state including:
- Current machine state (idle/displaying)
- Current text content
- History count
- Available actions

### `execute_action`
Executes an action. Available actions:
- `set_text` - Set text to a value (requires `{ text: "..." }` payload)
- `append_text` - Append to existing text (requires `{ text: "..." }` payload)
- `clear_text` - Clear all text
- `undo` - Undo last change (only available if history exists)
- `reset` - Reset to initial state

## State Machine

```
States: idle <-> displaying
                     |
                   error

Context:
- text: string (displayed text)
- history: string[] (previous text values)
- lastAction: string (last executed action)
- lastError: string (last error message)

Transitions:
- idle + set_text/append_text -> displaying
- displaying + clear_text -> idle
- displaying + undo -> idle (if text becomes empty)
```

## Development

### MCP Server
```bash
cd mcp-server
bun run dev
```

### Frontend
```bash
cd frontend
bun run dev
```

## Related Documentation

See `~/.lattice/docs/agentic-frontend/state-machine-architecture.md` for the full architecture specification.
