/**
 * @git-fabric/proxmox — FabricApp factory
 * 21 tools: nodes, VMs, containers, storage, tasks, snapshots, cluster
 */
import { createAdapterFromEnv } from './adapters/env.js';
export function createApp(adapterOverride) {
    const pve = adapterOverride ?? createAdapterFromEnv();
    const tools = [
        // Cluster
        { name: 'pve_cluster_status', description: 'Get overall Proxmox cluster status and resources.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: {} },
            execute: async () => pve.get('/cluster/resources') },
        // Nodes
        { name: 'pve_list_nodes', description: 'List all nodes in the Proxmox cluster.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: {} },
            execute: async () => pve.get('/nodes') },
        { name: 'pve_get_node_status', description: 'Get status and resource usage for a node.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' } }, required: ['node'] },
            execute: async (a) => pve.get(`/nodes/${a.node}/status`) },
        // VMs
        { name: 'pve_list_vms', description: 'List VMs — all nodes or a specific node.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string', description: 'Node name. Omit for all nodes.' } } },
            execute: async (a) => {
                if (a.node)
                    return pve.get(`/nodes/${a.node}/qemu`);
                const nodes = await pve.get('/nodes');
                const all = [];
                for (const n of nodes) {
                    const vms = await pve.get(`/nodes/${n.node}/qemu`);
                    vms.forEach((vm) => { vm.node = n.node; all.push(vm); });
                }
                return all;
            } },
        { name: 'pve_get_vm_config', description: 'Get configuration for a VM.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.get(`/nodes/${a.node}/qemu/${a.vmid}/config`) },
        { name: 'pve_get_vm_status', description: 'Get current status of a VM.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.get(`/nodes/${a.node}/qemu/${a.vmid}/status/current`) },
        { name: 'pve_start_vm', description: 'Start a VM.',
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.post(`/nodes/${a.node}/qemu/${a.vmid}/status/start`) },
        { name: 'pve_stop_vm', description: 'Force-stop a VM.',
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' }, timeout: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.post(`/nodes/${a.node}/qemu/${a.vmid}/status/stop`, a.timeout ? { timeout: a.timeout } : undefined) },
        { name: 'pve_shutdown_vm', description: 'Gracefully shut down a VM (ACPI).',
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' }, timeout: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.post(`/nodes/${a.node}/qemu/${a.vmid}/status/shutdown`, a.timeout ? { timeout: a.timeout } : undefined) },
        { name: 'pve_reboot_vm', description: 'Reboot a VM.',
            annotations: { readOnlyHint: false, destructiveHint: false },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.post(`/nodes/${a.node}/qemu/${a.vmid}/status/reboot`) },
        // Containers
        { name: 'pve_list_containers', description: 'List LXC containers on a node.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' } }, required: ['node'] },
            execute: async (a) => pve.get(`/nodes/${a.node}/lxc`) },
        { name: 'pve_get_container_status', description: 'Get status of an LXC container.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.get(`/nodes/${a.node}/lxc/${a.vmid}/status/current`) },
        { name: 'pve_start_container', description: 'Start an LXC container.',
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.post(`/nodes/${a.node}/lxc/${a.vmid}/status/start`) },
        { name: 'pve_stop_container', description: 'Stop an LXC container.',
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.post(`/nodes/${a.node}/lxc/${a.vmid}/status/stop`) },
        // Storage
        { name: 'pve_list_storage', description: 'List storage — cluster-wide or per node.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' } } },
            execute: async (a) => a.node ? pve.get(`/nodes/${a.node}/storage`) : pve.get('/storage') },
        { name: 'pve_get_storage_status', description: 'Get status of a storage device on a node.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, storage: { type: 'string' } }, required: ['node', 'storage'] },
            execute: async (a) => pve.get(`/nodes/${a.node}/storage/${a.storage}/status`) },
        // Tasks
        { name: 'pve_list_tasks', description: 'List recent tasks on a node or cluster.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, limit: { type: 'number' } } },
            execute: async (a) => { const p = a.limit ? { limit: a.limit } : undefined; return a.node ? pve.get(`/nodes/${a.node}/tasks`, p) : pve.get('/cluster/tasks', p); } },
        { name: 'pve_get_task_status', description: 'Get status of a specific task by UPID.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, upid: { type: 'string' } }, required: ['node', 'upid'] },
            execute: async (a) => pve.get(`/nodes/${a.node}/tasks/${encodeURIComponent(a.upid)}/status`) },
        // Snapshots
        { name: 'pve_list_vm_snapshots', description: 'List snapshots for a VM.',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' } }, required: ['node', 'vmid'] },
            execute: async (a) => pve.get(`/nodes/${a.node}/qemu/${a.vmid}/snapshot`) },
        { name: 'pve_create_vm_snapshot', description: 'Create a snapshot of a VM.',
            annotations: { readOnlyHint: false, destructiveHint: false },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' }, snapname: { type: 'string' }, description: { type: 'string' } }, required: ['node', 'vmid', 'snapname'] },
            execute: async (a) => { const d = { snapname: a.snapname }; if (a.description)
                d.description = a.description; return pve.post(`/nodes/${a.node}/qemu/${a.vmid}/snapshot`, d); } },
        { name: 'pve_delete_vm_snapshot', description: 'Delete a VM snapshot.',
            annotations: { readOnlyHint: false, destructiveHint: true },
            inputSchema: { type: 'object', properties: { node: { type: 'string' }, vmid: { type: 'number' }, snapname: { type: 'string' } }, required: ['node', 'vmid', 'snapname'] },
            execute: async (a) => pve.delete(`/nodes/${a.node}/qemu/${a.vmid}/snapshot/${a.snapname}`) },
    ];
    return {
        name: '@git-fabric/proxmox', version: '0.1.0',
        description: 'Proxmox VE fabric app — VMs, containers, nodes, storage, and snapshots',
        tools,
        async health() {
            const start = Date.now();
            try {
                await pve.get('/nodes');
                return { app: '@git-fabric/proxmox', status: 'healthy', latencyMs: Date.now() - start };
            }
            catch (e) {
                return { app: '@git-fabric/proxmox', status: 'unavailable', latencyMs: Date.now() - start, details: { error: String(e) } };
            }
        },
    };
}
//# sourceMappingURL=app.js.map