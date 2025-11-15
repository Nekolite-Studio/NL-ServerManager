# NL-ServerManager Communication Protocol

This document defines the communication protocol between the **Manager** (Electron UI) and the **Agent** (Node.js backend) using WebSockets, as well as the Inter-Process Communication (IPC) channels within the Manager.

## 1. General Principles

- **Naming Convention**: All WebSocket message types and IPC channel names use `kebab-case`.
- **Data Format**: All messages are JSON objects.
- **Asynchronous Responses**: For request/response patterns, responses should be wrapped in a consistent format:
  - **Success**: `{ success: true, payload: { ... } }`
  - **Failure**: `{ success: false, error: { message: "Error summary", details: "..." } }`
- **Broadcasts**: Events initiated by the Agent (e.g., server status change) are broadcast to all connected Managers.

## 2. WebSocket Protocol (Manager ↔ Agent)

### 2.1. Manager → Agent

| Type                  | Payload                               | Description                                                                 |
| --------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `get-system-info`     | `{}`                                  | Requests basic system information from the Agent (OS, Arch, etc.).          |
| `get-all-servers`     | `{}`                                  | Requests the full list of servers managed by the Agent.                     |
| `create-server`       | `{ versionId: string }`               | Requests the creation of a new Minecraft server for a specific version.     |
| `update-server`       | `{ serverId: string, config: object }`| Updates the configuration of an existing server.                            |
| `delete-server`       | `{ serverId: string }`                | Deletes a server directory and its configuration.                           |
| `control-server`      | `{ serverId: string, action: 'start' \| 'stop' }` | Starts or stops a specific Minecraft server.                            |
| `install-java`        | `{ javaInstallData: object }`         | Requests the download and installation of a specific Java version.          |

### 2.2. Agent → Manager

| Type                     | Payload                                      | Description                                                                                             |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `system-info-response`   | `{ os: string, arch: string, ... }`          | Response to `get-system-info`.                                                                          |
| `server-list-update`     | `Array<object>`                              | Broadcasts the updated list of all servers. Sent after any operation that changes the server list.      |
| `server-update`          | `{ serverId: string, status: string, log?: string }` | Broadcasts real-time updates for a single server (e.g., status change from 'stopped' to 'running'). |
| `java-install-status`    | `{ type: 'progress' \| 'success' \| 'error', ... }` | Provides real-time status updates for a Java installation process.                                |
| `operation-result`       | `{ success: boolean, operation: string, payload?: any, error?: object }` | A generic response for operations like create, update, delete, control, providing success or failure status. |

## 3. IPC Protocol (Main ↔ Renderer)

### 3.1. Renderer → Main

| Channel                 | Arguments                                    | Description                                                          |
| ----------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `renderer-ready`        | `()`                                         | Notifies the main process that the UI is loaded and ready.           |
| `request-agent-list`    | `()`                                         | Requests the current list of all configured agents.                  |
| `add-agent`             | `(config: object)`                           | Adds a new agent and connects to it.                                 |
| `update-agent-settings` | `({ agentId: string, config: object })`      | Updates the settings for an existing agent.                          |
| `delete-agent`          | `({ agentId: string })`                      | Deletes an agent configuration.                                      |
| `proxy-to-agent`        | `({ agentId: string, message: object })`     | A proxy channel to send any WebSocket message to a specific agent.   |
| `get-minecraft-versions`| `()`                                         | Requests the list of available Minecraft versions from Mojang.       |
| `get-java-download-info`| `(params: object)`                           | (ipc.handle) Requests Java download info from the Adoptium API.      |

### 3.2. Main → Renderer

| Channel                | Arguments                               | Description                                                              |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| `initial-load-complete`| `()`                                    | Sent after the main process has finished its initial setup.              |
| `agent-list`           | `(agents: Array<object>)`               | Sends the full list of agents with their status.                         |
| `agent-status-update`  | `(agent: object)`                       | Sends an update for a single agent's status or configuration.            |
| `agent-log-entry`      | `({ agentId: string, message: string })`| Sends a new log message for a specific agent.                            |
| `agent-data`           | `({ agentId: string, data: object })`   | A generic channel for forwarding data received from an agent. **(To be refactored)** |
| `minecraft-versions`   | `({ success: boolean, versions?: Array, error?: string })` | Sends the fetched list of Minecraft versions or an error. |
| `server-list-update`   | `({ agentId: string, servers: Array })` | Relays the server list update from an agent.                             |
| `operation-failed`     | `({ agentId: string, error: string })`  | Notifies the UI of a failed operation. **(To be refactored/unified)**    |