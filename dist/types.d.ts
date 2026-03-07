/**
 * @git-fabric/proxmox — shared types
 *
 * Covers: nodes, VMs, containers, storage, tasks, snapshots, cluster
 */
export interface ProxmoxAdapter {
    get(path: string, params?: Record<string, unknown>): Promise<unknown>;
    post(path: string, data?: Record<string, unknown>): Promise<unknown>;
    put(path: string, data?: Record<string, unknown>): Promise<unknown>;
    delete(path: string): Promise<unknown>;
}
//# sourceMappingURL=types.d.ts.map