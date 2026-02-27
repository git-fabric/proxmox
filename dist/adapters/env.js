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
export function createAdapterFromEnv() {
    const host = process.env.PROXMOX_HOST;
    const port = process.env.PROXMOX_PORT ?? '8006';
    const user = process.env.PROXMOX_USER;
    const tokenName = process.env.PROXMOX_TOKEN_NAME;
    const tokenValue = process.env.PROXMOX_TOKEN_VALUE;
    const password = process.env.PROXMOX_PASSWORD;
    const verifySSL = process.env.PROXMOX_VERIFY_SSL === 'true';
    if (!host || !user)
        throw new Error('PROXMOX_HOST and PROXMOX_USER are required');
    if (!tokenName && !password)
        throw new Error('PROXMOX_TOKEN_NAME+PROXMOX_TOKEN_VALUE or PROXMOX_PASSWORD required');
    if (!verifySSL)
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const base = `https://${host}:${port}/api2/json`;
    let ticket = null;
    let csrf = null;
    async function auth() {
        if (tokenName && tokenValue) {
            return { Authorization: `PVEAPIToken=${user}!${tokenName}=${tokenValue}` };
        }
        if (!ticket) {
            const res = await fetch(`${base}/access/ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: user, password: password }),
            });
            if (!res.ok)
                throw new Error(`Proxmox auth failed: ${res.status}`);
            const data = await res.json();
            ticket = data.data.ticket;
            csrf = data.data.CSRFPreventionToken;
        }
        return { Cookie: `PVEAuthCookie=${ticket}` };
    }
    async function pve(method, path, body) {
        const headers = await auth();
        if (method !== 'GET' && csrf)
            headers.CSRFPreventionToken = csrf;
        const url = `${base}${path}`;
        const init = { method, headers };
        if (body && method !== 'GET') {
            init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            init.body = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
        }
        const res = await fetch(method === 'GET' && body
            ? `${url}?${new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]))}`
            : url, init);
        if (!res.ok)
            throw new Error(`Proxmox ${method} ${path}: ${res.status} ${await res.text()}`);
        return (await res.json()).data;
    }
    return {
        get: (path, params) => pve('GET', path, params),
        post: (path, data) => pve('POST', path, data),
        put: (path, data) => pve('PUT', path, data),
        delete: (path) => pve('DELETE', path),
    };
}
//# sourceMappingURL=env.js.map