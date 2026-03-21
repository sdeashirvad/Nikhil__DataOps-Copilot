# DataOps Copilot

DataOps Copilot is a production-oriented VS Code extension for Snowflake development. It combines connection management, schema exploration, query execution, result visualization, AI-assisted SQL tooling, and pre-execution cost prediction in a single workflow inside the editor.

## Overview

DataOps Copilot is designed for data engineers and analytics engineers who want to:

- Manage Snowflake connections directly from VS Code
- Browse databases, schemas, and tables from a sidebar
- Preview tables with one click
- Run SQL from the active editor
- Review query history
- Generate SQL from natural language with AI
- Optimize SQL with AI suggestions and replace-in-editor flow
- Predict query cost before execution using rule-based and AI-assisted analysis

## Features

### Connection Management

- Multi-connection Snowflake support
- Switch active connection from command palette or status bar
- Remove saved connections
- Secure credential storage through VS Code SecretStorage
- Persisted connection metadata through VS Code global state

### Schema Explorer

- Sidebar tree view for:
   - Databases
   - Schemas
   - Tables
- Lazy loading of metadata
- Loading and error states in the tree
- One-click table preview

### Query Execution

- Run SQL from the active editor or current selection
- Keyboard shortcut for fast execution
- Results shown in a rich webview
- Query execution history stored locally
- Query results logged to the DataOps output channel

### Query Preview and Result UI

- Auto-preview on table click
- Sticky table headers
- Scrollable result grid
- Client-side column sorting
- Click-to-copy cell values
- Export results to CSV
- Query metrics panel with:
   - Query type
   - Execution time
   - Row count
   - Cost badge
   - Scan size badge
   - Warning banners

### AI SQL Intelligence

- AI Query Optimizer
   - Analyzes SQL for performance issues
   - Suggests improvements
   - Generates optimized SQL
   - Replace Query button updates editor content directly
- AI Query Generator
   - Converts natural language prompts into Snowflake SQL
   - Uses schema and column context when available
   - Inserts generated SQL into the current editor or opens a new SQL document

### Query Cost Predictor

- Rule-based cost analysis before execution
- Optional AI-enhanced cost estimation
- Detects common cost/performance risks such as:
   - `SELECT *`
   - Missing `WHERE`
   - Missing `LIMIT`
   - Multiple `JOIN`s
   - Large known tables via environment hints
- Shows pre-run warning modal for risky queries
- Allows users to cancel execution before running high-cost SQL

### Productivity and UX

- Active connection shown in status bar
- Editor toolbar commands for SQL workflows
- Command palette integration for all major actions
- Progress notifications for query execution, preview, AI tasks, and cost analysis
- Query History view with reopen and rerun actions

## Commands

- `DataOps: Add Connection` (`dataops.addConnection`)
- `DataOps: Remove Connection` (`dataops.removeConnection`)
- `DataOps: Switch Active Connection` (`dataops.switchConnection`)
- `DataOps: Run Active SQL Query` (`dataops.runQuery`)
- `DataOps: Preview Table` (`dataops.previewTable`)
- `DataOps: Predict Query Cost` (`dataops.predictQueryCost`)
- `DataOps: Optimize Query` (`dataops.optimizeQuery`)
- `DataOps: Generate SQL` (`dataops.generateQuery`)
- `DataOps: Refresh Connections` (`dataops.refreshConnections`)
- `DataOps: Clear Query History` (`dataops.clearHistory`)
- `Open in Editor` (`dataops.openHistoryItem`)
- `Re-run Query` (`dataops.rerunHistoryItem`)

## Keyboard Shortcuts

- `Ctrl+Enter` runs the active SQL query
- `Ctrl+Alt+P` predicts query cost
- `Ctrl+Alt+O` optimizes the current query
- `Ctrl+Alt+G` generates SQL from natural language

## Technology Stack

### Core Extension Stack

- TypeScript
- VS Code Extension API
- CommonJS output for VS Code runtime

### Data Platform Integration

- `snowflake-sdk` for Snowflake connectivity and query execution

### AI Integration

- `@google/genai` for Gemini integration
- `axios` for OpenAI-compatible chat completions
- Pluggable AI provider design for Gemini and OpenAI

### Configuration and Storage

- `dotenv` for local `.env` configuration
- VS Code SecretStorage for secrets
- VS Code global state for metadata and query history

### Tooling

- TypeScript compiler
- ESLint

## Configuration

### AI Provider Configuration

Create a local `.env` file in the project root.

Example Gemini setup:

```env
DATAOPS_AI_PROVIDER=gemini
DATAOPS_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
DATAOPS_GEMINI_MODEL=gemini-3-flash-preview
```

Example OpenAI setup:

```env
DATAOPS_AI_PROVIDER=openai
DATAOPS_OPENAI_API_KEY=YOUR_OPENAI_API_KEY
DATAOPS_OPENAI_MODEL=gpt-4o-mini
```

Optional large-table hints for cost prediction:

```env
DATAOPS_LARGE_TABLES=FACT_ORDERS,EVENTS,RAW_CLICKSTREAM
```

## Views

The extension contributes a DataOps activity bar container with:

- `Connections` view
- `Query History` view

## Development

1. Install dependencies:

```bash
npm install
```

2. Compile the extension:

```bash
npm run compile
```

3. Lint the codebase:

```bash
npm run lint
```

4. Launch the Extension Development Host:

- Open this folder in VS Code
- Press `F5`

## Typical Workflow

1. Add a Snowflake connection
2. Switch the active connection if needed
3. Browse databases, schemas, and tables in the sidebar
4. Click a table to preview data
5. Write or paste SQL in a `.sql` file
6. Predict cost before execution if needed
7. Run the query
8. Review results in the webview
9. Optimize the query or generate a new one with AI
10. Reopen or rerun previous work from Query History

## Notes

- Credentials are stored in VS Code SecretStorage and are not written to source control.
- Connection metadata and query history are stored in VS Code global state.
- Local `.env` files are ignored by git.
- Query output and failures are also written to the `DataOps Copilot` output channel.
- AI-powered features degrade gracefully when provider credentials are not configured.
