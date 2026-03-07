/**
 * Proxmox VE environment adapter
 *
 * Required:
 *   PROXMOX_HOST      — hostname or IP
 *   PROXMOX_USER      — e.g. root@pam or pveauditor@pve
 *
 * Auth (one of):
 *   PROXMOX_TOKEN_NAME + PROXMOX_TOKEN_VALUE  — API token (recommended)
 *   PROXMOX_PASSWORD                           — password auth (ticket)
 *
 * Optional:
 *   PROXMOX_PORT       — default 8006
 *   PROXMOX_VERIFY_SSL — default false
 */
import type { ProxmoxAdapter } from '../types.js';
export type { ProxmoxAdapter } from '../types.js';
export declare function createAdapterFromEnv(): ProxmoxAdapter;
//# sourceMappingURL=env.d.ts.map