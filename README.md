# Pane

AI-controllable UI canvas for Claude Code.

![Demo](assets/agentic-ui-demo.gif)

## Getting Started (30 seconds)

**Requires [Bun](https://bun.sh)** (for TypeScript execution)

```bash
claude mcp add pane -- bunx @zabaca/pane
```

Then open **http://localhost:3000** and ask Claude:

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
