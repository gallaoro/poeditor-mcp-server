# POEditor MCP Server

Manage POEditor translations directly from Cursor or Claude Desktop using the Model Context Protocol.

## What is this?

An MCP server that connects your AI coding assistant to [POEditor](https://poeditor.com) - allowing you to manage translations without leaving your editor.

## Quick Setup

### 1. Get Your API Token

Get your token from: https://poeditor.com/account/api

### 2. Run with Docker

**Option A: Pull from Docker Hub (Recommended)**

```bash
# Run the pre-built image directly (no need to clone this repo)
docker run -d -p 9142:9142 \
  -e POEDITOR_API_TOKEN=your_token_here \
  --name poeditor-mcp \
  gabrielepallaoro/poeditor-mcp-server:latest

# Verify it's running
curl http://localhost:9142/health
```

**Option B: Build from Source**

```bash
# Clone this repository first
git clone https://github.com/gallaoro/poeditor-mcp-server.git
cd poeditor-mcp-server

# Build the image
docker build -t poeditor-mcp-server .

# Run the container
docker run -d -p 9142:9142 \
  -e POEDITOR_API_TOKEN=your_token_here \
  --name poeditor-mcp \
  poeditor-mcp-server

# Verify it's running
curl http://localhost:9142/health
```

### 3. Configure Cursor/Claude Desktop

Add to your MCP settings:

```json
{
  "mcpServers": {
    "poeditor": {
      "url": "http://localhost:9142/sse"
    }
  }
}
```

Restart your editor. Done! ✅

## What You Can Do

Ask your AI assistant things like:

- "Check my POEditor configuration"
- "List all translation projects"
- "Show untranslated French terms in project 7717"
- "Add a new term 'save_button' with English translation 'Save' to project 7717"
- "Export project 7717 in JSON format for English and French"

## Available Tools

1. **check_configuration** - Verify API token works
2. **list_projects_with_languages** - See all projects with translation progress
3. **list_terms_of_a_project** - Browse terms (filter by tags, status, file reference)
4. **add_terms_to_a_project** - Add new translation strings with initial translations
5. **update_terms_of_a_project** - Update terms and translations together
6. **delete_term_from_a_project** - Remove obsolete terms (one at a time for safety)
7. **export_project** - Export multiple languages at once in various formats

## Example: Adding Terms

In Cursor, just ask:

> "Add a term 'welcome_message' to project 7717 with translations: English 'Welcome!' and French 'Bienvenue!'"

The AI handles the rest using this tool input:

```json
{
  "project_id": 7717,
  "terms": [{
    "term": "welcome_message",
    "translations": {
      "en": "Welcome!",
      "fr": "Bienvenue!"
    }
  }]
}
```

## Example: Finding Terms

Ask:

> "Show me all untranslated terms tagged 'settings' in project 7717"

The AI uses filters automatically:

```json
{
  "project_id": 7717,
  "tags": ["settings"],
  "translation_status": "untranslated"
}
```

## Example: Exporting

Ask:

> "Export project 7717 in JSON for English, French, and Spanish"

You get download URLs (valid for 10 minutes):

```json
{
  "exports": [
    {
      "language_code": "en",
      "download_url": "https://api.poeditor.com/v2/download/...",
      "format": "json"
    }
  ]
}
```

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs poeditor-mcp

# Common fixes:
# - Port 9142 in use? Try: -p 9143:9142
# - Token not set? Verify: docker inspect poeditor-mcp
```

### Cursor can't connect

1. Verify server is running: `curl http://localhost:9142/health`
2. Check MCP config has correct URL: `http://localhost:9142/sse`
3. Restart Cursor after config changes

### Invalid API token

Test your token manually:
```bash
curl -X POST https://api.poeditor.com/v2/projects/list \
  -d api_token="your_token"
```

## Docker Commands

```bash
# View logs
docker logs -f poeditor-mcp

# Restart
docker restart poeditor-mcp

# Stop
docker stop poeditor-mcp

# Remove
docker rm -f poeditor-mcp

# Rebuild
docker build -t poeditor-mcp-server . && docker restart poeditor-mcp
```

## Environment Variables

- `POEDITOR_API_TOKEN` (required) - Your API token
- `PORT` (optional) - Server port (default: 9142)

## Advanced Features

### Filtering Terms

Find terms by:
- **Tags**: `tags: ["v2.0", "settings"]`
- **Status**: `translation_status: "untranslated"`
- **File**: `reference_pattern: "Settings.tsx"`

### Safe Updates

Update terms and translations together:
```json
{
  "term": "old_name",
  "context": "page",
  "new_term": "new_name",
  "translations": { "en": "Updated text" }
}
```

Set `fuzzy_trigger: true` to mark other language translations as needing review.

### Export Formats

Supported: `json`, `po`, `pot`, `mo`, `xls`, `xlsx`, `csv`, `ini`, `properties`, `android_strings`, `apple_strings`, `xliff`

## Links

- POEditor API: https://poeditor.com/docs/api
- MCP Specification: https://modelcontextprotocol.io
