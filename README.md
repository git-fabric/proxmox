# @git-fabric/proxmox

Proxmox VE fabric -- a self-contained autonomous MCP server for Proxmox Virtual Environment management. Part of the [git-fabric](https://github.com/git-fabric) ecosystem.

## What it is

A fabric is a self-contained autonomous system: MCP server + AIANA knowledge loop + local LLM routing. `@git-fabric/proxmox` exposes 21 tools for managing Proxmox VE clusters -- VMs, containers, nodes, storage, tasks, and snapshots -- through the standard MCP protocol (stdio + StreamableHTTP). It registers with the fabric gateway using BGP-style route advertisements so that queries about Proxmox infrastructure are resolved locally before falling back to Claude.

## Tools

| Tool | Description |
|------|-------------|
| `pve_cluster_status` | Get cluster status and quorum information |
| `pve_list_nodes` | List all nodes in the cluster |
| `pve_get_node_status` | Get detailed status for a specific node |
| `pve_list_vms` | List all QEMU virtual machines |
| `pve_get_vm_config` | Get configuration for a specific VM |
| `pve_get_vm_status` | Get runtime status for a specific VM |
| `pve_start_vm` | Start a virtual machine |
| `pve_stop_vm` | Stop a virtual machine (hard stop) |
| `pve_shutdown_vm` | Gracefully shut down a virtual machine |
| `pve_reboot_vm` | Reboot a virtual machine |
| `pve_list_containers` | List all LXC containers |
| `pve_get_container_status` | Get runtime status for a specific container |
| `pve_start_container` | Start an LXC container |
| `pve_stop_container` | Stop an LXC container |
| `pve_list_storage` | List all storage pools |
| `pve_get_storage_status` | Get status and usage for a storage pool |
| `pve_list_tasks` | List recent tasks |
| `pve_get_task_status` | Get status and log for a specific task |
| `pve_list_vm_snapshots` | List snapshots for a VM |
| `pve_create_vm_snapshot` | Create a snapshot of a VM |
| `pve_delete_vm_snapshot` | Delete a VM snapshot |

## OSI Layer Architecture

The fabric maps cleanly onto the OSI model, from physical API through application logic:

```
Layer 7 -- Application    app.ts (FabricApp factory, 21 tools)
Layer 6 -- Presentation   bin/cli.js (MCP stdio + HTTP, aiana_query)
Layer 5 -- Session        (stateless -- direct API queries)
Layer 4 -- Transport      MCP protocol (stdio + StreamableHTTP)
Layer 3 -- Network        Gateway registration (AS65006, fabric.proxmox.*)
Layer 2 -- Data Link      adapters/env.ts (Proxmox REST API)
Layer 1 -- Physical       Proxmox VE API
```

## Gateway Registration

When `GATEWAY_URL` is set, the fabric registers with the gateway using BGP-style route advertisements:

- **AS Number:** `AS65006`
- **Advertised routes:**
  - `fabric.proxmox` -- top-level Proxmox domain
  - `fabric.proxmox.vms` -- virtual machine operations
  - `fabric.proxmox.containers` -- LXC container operations
  - `fabric.proxmox.nodes` -- node status and management
  - `fabric.proxmox.storage` -- storage pool queries
  - `fabric.proxmox.snapshots` -- snapshot lifecycle

The gateway maintains an F-RIB (Fabric Routing Information Base) and routes incoming queries to the most specific matching fabric. Queries that match `fabric.proxmox.*` prefixes are resolved locally via this fabric's tools and AIANA knowledge base before falling back to Claude as the default route.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PROXMOX_HOST` | Yes | Proxmox VE host (e.g. `10.88.145.58`) |
| `PROXMOX_USER` | Yes | API user (e.g. `root@pam`) |
| `PROXMOX_TOKEN_NAME` | Yes* | API token name |
| `PROXMOX_TOKEN_VALUE` | Yes* | API token value |
| `PROXMOX_PASSWORD` | Alt* | Password auth (alternative to token) |
| `PROXMOX_PORT` | No | API port (default: `8006`) |
| `PROXMOX_VERIFY_SSL` | No | Verify TLS certificates (default: `false`) |
| `MCP_HTTP_PORT` | No | HTTP transport port for gateway mode |
| `GATEWAY_URL` | No | Gateway URL for route registration |
| `POD_IP` | No | Pod IP for gateway callback (k8s) |
| `OLLAMA_ENDPOINT` | No | Ollama URL for local LLM routing |
| `OLLAMA_MODEL` | No | Model name for local inference |

\* Provide either `PROXMOX_TOKEN_NAME` + `PROXMOX_TOKEN_VALUE`, or `PROXMOX_PASSWORD`.

## Library

The `library.ts` module provides a curated knowledge base sourced from the [Proxmox VE documentation](https://pve.proxmox.com/pve-docs/). This is the fabric's deterministic routing layer -- answers that match library entries are returned at confidence >= 0.95 without touching a model.

## Usage

### Standalone (stdio)

```json
{
  "mcpServers": {
    "proxmox": {
      "command": "node",
      "args": ["bin/cli.js"],
      "env": {
        "PROXMOX_HOST": "10.88.145.58",
        "PROXMOX_USER": "root@pam",
        "PROXMOX_TOKEN_NAME": "fabric",
        "PROXMOX_TOKEN_VALUE": "your-token-here"
      }
    }
  }
}
```

### With Gateway

Set `GATEWAY_URL` and `MCP_HTTP_PORT` to enable route registration and HTTP transport. The fabric will advertise its `fabric.proxmox.*` routes to the gateway on startup.

```bash
PROXMOX_HOST=10.88.145.58 \
PROXMOX_USER=root@pam \
PROXMOX_TOKEN_NAME=fabric \
PROXMOX_TOKEN_VALUE=your-token-here \
GATEWAY_URL=http://gateway:3000 \
MCP_HTTP_PORT=3006 \
node bin/cli.js
```

## Related

- [fabric-sdk](https://github.com/git-fabric/sdk) -- SDK specification, ADRs, and the BGP routing model
- [git-fabric](https://github.com/git-fabric) -- the full ecosystem of fabric apps

## License

MIT
