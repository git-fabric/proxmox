/**
 * Library — git-based knowledge retrieval for fabric-proxmox
 *
 * The librarian model: we know where the books are, we go fetch them
 * when asked, and we return them when done. No photocopies.
 *
 * Sources:
 *   - proxmox/pve-docs — official Proxmox VE documentation
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/tmp/fabric-library';

interface LibrarySource {
  id: string;
  repo: string;
  branch: string;
  description: string;
  topics: TopicEntry[];
  useRawApi?: boolean;
}

interface TopicEntry {
  keywords: string[];
  files: string[];
  description: string;
}

const SOURCES: LibrarySource[] = [
  {
    id: 'pve-docs',
    repo: 'https://git.proxmox.com/git/pve-docs.git',
    branch: 'master',
    description: 'Proxmox VE official documentation — administration, configuration, API',
    useRawApi: false,
    topics: [
      // VMs
      { keywords: ['vm', 'virtual machine', 'qemu', 'kvm', 'create vm', 'clone', 'template'],
        files: ['qm.adoc', 'qm-cloud-init.adoc'],
        description: 'Virtual machine management — create, configure, clone, templates' },
      // Containers
      { keywords: ['container', 'lxc', 'ct', 'unprivileged', 'pct'],
        files: ['pct.adoc'],
        description: 'LXC container management — create, configure, templates' },
      // Storage
      { keywords: ['storage', 'zfs', 'ceph', 'lvm', 'nfs', 'iscsi', 'disk', 'volume'],
        files: ['pvesm.adoc', 'sysadmin.adoc'],
        description: 'Storage management — ZFS, Ceph, LVM, NFS, iSCSI' },
      // Networking
      { keywords: ['network', 'bridge', 'vlan', 'bond', 'sdn', 'firewall rule', 'interface', 'ip'],
        files: ['pve-network.adoc', 'pvesdn.adoc'],
        description: 'Network configuration — bridges, VLANs, bonds, SDN' },
      // Backup
      { keywords: ['backup', 'restore', 'vzdump', 'snapshot', 'schedule backup', 'pbs'],
        files: ['vzdump.adoc', 'pve-storage-pbs.adoc'],
        description: 'Backup and restore — vzdump, PBS, scheduled backups' },
      // Clustering
      { keywords: ['cluster', 'ha', 'high availability', 'corosync', 'quorum', 'migration', 'live migrate', 'pvecm'],
        files: ['pvecm.adoc', 'ha-manager.adoc'],
        description: 'Clustering and HA — corosync, quorum, live migration' },
      // Firewall
      { keywords: ['firewall', 'iptables', 'nftables', 'security group', 'ipset', 'pve-firewall'],
        files: ['pve-firewall.adoc'],
        description: 'Firewall — rules, security groups, IP sets' },
      // General admin
      { keywords: ['install', 'upgrade', 'update', 'repository', 'subscription', 'apt'],
        files: ['sysadmin.adoc', 'getting-started.adoc'],
        description: 'System administration — installation, upgrades, repositories' },
      // API
      { keywords: ['api', 'rest', 'token', 'authentication', 'permission', 'role', 'user', 'acl'],
        files: ['pveum.adoc', 'api-viewer/apidoc.js'],
        description: 'API and authentication — tokens, permissions, roles, ACLs' },
    ],
  },
];

export class Library {
  private cacheDir: string;

  constructor() {
    this.cacheDir = LIBRARY_DIR;
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  findTopics(query: string): { source: LibrarySource; topic: TopicEntry; score: number }[] {
    const q = query.toLowerCase();
    const matches: { source: LibrarySource; topic: TopicEntry; score: number }[] = [];

    for (const source of SOURCES) {
      for (const topic of source.topics) {
        let score = 0;
        for (const kw of topic.keywords) {
          if (q.includes(kw)) {
            score += kw.length;
          }
        }
        if (score > 0) {
          matches.push({ source, topic, score });
        }
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  checkout(source: LibrarySource): string {
    if (source.useRawApi) return '';

    const localPath = join(this.cacheDir, source.id);

    if (existsSync(join(localPath, '.git'))) {
      try {
        execSync(`git -C ${localPath} pull --depth 1 --rebase 2>/dev/null || true`, {
          timeout: 15000,
          stdio: 'pipe',
        });
      } catch {
        // Stale cache is better than no cache
      }
      return localPath;
    }

    execSync(
      `git clone --depth 1 --branch ${source.branch} ${source.repo} ${localPath}`,
      { timeout: 60000, stdio: 'pipe' }
    );

    return localPath;
  }

  readFiles(source: LibrarySource, files: string[]): string {
    if (source.useRawApi) {
      return this.readFilesFromGitHub(source, files);
    }

    const localPath = this.checkout(source);
    const sections: string[] = [];

    for (const file of files) {
      const fullPath = join(localPath, file);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const trimmed = content.length > 8000
            ? content.slice(0, 8000) + '\n\n...[truncated — full source at ' + file + ']'
            : content;
          sections.push(`--- ${file} ---\n${trimmed}`);
        } catch {
          // Skip unreadable files
        }
      }
    }

    return sections.join('\n\n');
  }

  private readFilesFromGitHub(source: LibrarySource, files: string[]): string {
    const match = source.repo.match(/github\.com\/([^/]+\/[^/.]+)/);
    if (!match) return '';

    const ownerRepo = match[1];
    const sections: string[] = [];

    for (const file of files) {
      try {
        const url = `https://raw.githubusercontent.com/${ownerRepo}/${source.branch}/${file}`;
        const content = execSync(`curl -sf --max-time 10 "${url}"`, {
          timeout: 12000,
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf-8',
        });
        if (content) {
          const trimmed = content.length > 8000
            ? content.slice(0, 8000) + '\n\n...[truncated — full source at ' + file + ']'
            : content;
          sections.push(`--- ${file} ---\n${trimmed}`);
        }
      } catch {
        // Skip unavailable files
      }
    }

    return sections.join('\n\n');
  }

  async query(queryText: string): Promise<{ context: string; confidence: number; sources: string[] } | null> {
    const matches = this.findTopics(queryText);
    if (matches.length === 0) return null;

    const topMatches = matches.slice(0, 3);
    const seenFiles = new Set<string>();
    const filesToRead: { source: LibrarySource; file: string }[] = [];

    for (const m of topMatches) {
      for (const f of m.topic.files) {
        const key = `${m.source.id}:${f}`;
        if (!seenFiles.has(key)) {
          seenFiles.add(key);
          filesToRead.push({ source: m.source, file: f });
        }
      }
    }

    const capped = filesToRead.slice(0, 6);

    const bySource = new Map<string, { source: LibrarySource; files: string[] }>();
    for (const { source, file } of capped) {
      const existing = bySource.get(source.id);
      if (existing) {
        existing.files.push(file);
      } else {
        bySource.set(source.id, { source, files: [file] });
      }
    }

    const sections: string[] = [];
    const sources: string[] = [];
    for (const { source, files } of bySource.values()) {
      try {
        const content = this.readFiles(source, files);
        if (content) {
          sections.push(content);
          sources.push(...files.map(f => `${source.id}/${f}`));
        }
      } catch {
        // Continue with other sources
      }
    }

    if (sections.length === 0) return null;

    const context = sections.join('\n\n');
    const bestScore = topMatches[0].score;
    const confidence = Math.min(0.92, 0.6 + bestScore * 0.04);

    return { context, confidence, sources };
  }

  listSources(): { id: string; repo: string; topics: number; description: string }[] {
    return SOURCES.map(s => ({
      id: s.id,
      repo: s.repo,
      topics: s.topics.length,
      description: s.description,
    }));
  }
}
