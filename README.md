# Pane

AI-controllable UI canvas with MCP support (Claude Code, Cursor, and more).

![Demo](assets/agentic-ui-demo.gif)

## Getting Started

**Requires [Bun](https://bun.sh)** (for TypeScript execution)

### Claude Code (30 seconds)

```bash
claude mcp add pane -- bunx @zabaca/pane
```

### Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json` or via Settings > MCP):

```json
{
  "mcpServers": {
    "pane": {
      "command": "bunx",
      "args": ["--bun", "@zabaca/pane"]
    }
  }
}
```

Then restart Cursor.

### Using Pane

Open **http://localhost:3000** and ask your AI:

> *"Use Pane to show me a welcome message"*

That's it!

---

## Architecture

```
Claude Code <--stdio--> MCP Server <--WebSocket--> Vue Frontend
                            |
                        XState Machine
                        (holds state)
```

## Features

- **Text & Markdown Display** - Rich content with Mermaid diagram support
- **User Input Forms** - Single and multi-field forms with various input types
- **Long-Polling** - Auto-trigger when user submits (no manual Enter needed)
- **State Persistence** - Full state restoration across MCP restarts
- **User Context** - Persistent key-value storage across interactions

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_app_info` | Get app info and capabilities |
| `get_current_state` | Get current state, text, and available actions |
| `execute_action` | Execute actions (set_text, set_markdown, clear, undo, reset) |
| `show_input_form` | Display single-field input form |
| `show_multi_form` | Display multi-field form |
| `get_user_input` | Long-poll for user input (blocks until submitted) |
| `get_user_context` | Get persistent user context values |
| `set_user_context` | Set a user context value |
| `clear_user_context` | Clear all user context |

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

## License

MIT
