/**
 * Copyright 2025 Magic Mount-rs Authors
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * 说明：
 * - 本文件为"外部数据获取"的独立封装，不依赖其他 webui 业务文件。
 * - 仅依赖浏览器运行时能力（fetch/localStorage/window）与可选 kernelsu 模块。
 */

export interface MagicConfig {
  mountsource: string;
  umount: boolean;
  partitions: string[];
}

export interface MagicModule {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  is_mounted: boolean;
  mode: string;
  rules: { default_mode: string; paths: Record<string, unknown> };
}

export interface SystemInfo {
  kernel: string;
  selinux: string;
  mountBase: string;
  activeMounts: string[];
}

export interface StorageUsage {
  type: string | null;
  percent: string;
  size: string;
  used: string;
}

export interface DeviceStatus {
  model: string;
  android: string;
  kernel: string;
  selinux: string;
}

export interface ContributorProfile {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
  name?: string;
  bio?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ContributorFetchOptions {
  owner?: string;
  repo?: string;
  cacheKey?: string;
  cacheDurationMs?: number;
}

export interface StatusSnapshot {
  device: DeviceStatus;
  version: string;
  storage: StorageUsage;
  systemInfo: SystemInfo;
  activePartitions: string[];
}

const DEFAULT_REPO_OWNER = "originalFactor";
const DEFAULT_REPO_NAME = "meta-magic_mount-rs";
const DEFAULT_CACHE_KEY = "mm_contributors_cache";
const DEFAULT_CACHE_DURATION_MS = 1000 * 60 * 60;

const DEFAULT_CONFIG: MagicConfig = {
  mountsource: "KSU",
  umount: true,
  partitions: [],
};

const PATHS = {
  CONFIG: "/data/adb/magic_mount/config.toml",
};

const MOCK_DELAY_MS = 300;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface KsuExecResult {
  errno: number;
  stdout: string;
  stderr: string;
}
type KsuExec = (cmd: string) => Promise<KsuExecResult>;

let ksuExec: KsuExec | null = null;
let ksuResolved = false;
let mockModeResolved = false;
let mockMode = true;

async function resolveKsuExec(): Promise<void> {
  if (ksuResolved) {
    return;
  }

  try {
    const ksu = await import("kernelsu").catch(() => null);
    ksuExec = (ksu as { exec?: KsuExec } | null)?.exec ?? null;
  } catch {
    ksuExec = null;
  } finally {
    ksuResolved = true;
  }
}

function isDevMode(): boolean {
  try {
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

async function shouldUseMockMode(): Promise<boolean> {
  if (mockModeResolved) {
    return mockMode;
  }

  await resolveKsuExec();

  if (isDevMode() || !ksuExec) {
    mockMode = true;
    mockModeResolved = true;
    return mockMode;
  }

  try {
    const probe = await ksuExec("echo __MM_KSU_PROBE__");
    mockMode = probe.errno !== 0;
  } catch {
    mockMode = true;
  }

  mockModeResolved = true;
  return mockMode;
}

function isTrueValue(v: unknown): boolean {
  const s = String(v).trim().toLowerCase();

  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function stripQuotes(v: string): string {
  if (v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1);
  }

  return v;
}

function parseKvConfig(text: string): MagicConfig {
  const result: MagicConfig = { ...DEFAULT_CONFIG };

  for (let line of text.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key || !value) {
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1);
      if (!value.trim()) {
        if (key === "partitions") {
          result.partitions = [];
        }
        continue;
      }

      const items = value.split(",").map((s) => stripQuotes(s.trim()));
      if (key === "partitions") {
        result.partitions = items;
      }
      continue;
    }

    const raw = value;
    value = stripQuotes(value);

    if (key === "mountsource") {
      result.mountsource = value;
    } else if (key === "umount") {
      result.umount = isTrueValue(raw);
    }
  }

  return result;
}

function serializeKvConfig(cfg: MagicConfig): string {
  const q = (s: string) => `"${s}"`;

  return [
    "# Magic Mount Configuration File",
    "",
    `mountsource = ${q(cfg.mountsource)}`,
    `umount = ${cfg.umount}`,
    `partitions = [${cfg.partitions.map((p) => q(p)).join(", ")}]`,
  ].join("\n");
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) {
    return "0 B";
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

async function ksuRun(cmd: string): Promise<KsuExecResult> {
  await resolveKsuExec();
  if (!ksuExec) {
    return { errno: 1, stdout: "", stderr: "kernelsu unavailable" };
  }

  return ksuExec(cmd);
}

function readCache<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { data: T; timestamp: number };
    if (Date.now() - parsed.timestamp <= maxAgeMs) {
      return parsed.data;
    }
  } catch {
    localStorage.removeItem(key);
  }

  return null;
}

function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    key,
    JSON.stringify({
      data,
      timestamp: Date.now(),
    }),
  );
}

async function fetchContributorProfiles(
  owner = DEFAULT_REPO_OWNER,
  repo = DEFAULT_REPO_NAME,
): Promise<ContributorProfile[]> {
  const listRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contributors`,
  );
  if (!listRes.ok) {
    throw new Error(`Failed to fetch contributors: ${listRes.status}`);
  }

  const baseList = (await listRes.json()) as ContributorProfile[];
  const filtered = baseList.filter((user) => {
    const isBotType = user.type === "Bot";
    const hasBotName = user.login.toLowerCase().includes("bot");

    return !isBotType && !hasBotName;
  });

  const details = await Promise.all(
    filtered.map(async (user) => {
      if (!user.url) {
        return user;
      }

      try {
        const detailRes = await fetch(user.url);
        if (!detailRes.ok) {
          return user;
        }

        const detail = (await detailRes.json()) as {
          bio?: string;
          name?: string;
        };

        return {
          ...user,
          bio: detail.bio,
          name: detail.name ?? user.login,
        };
      } catch {
        return user;
      }
    }),
  );

  return details;
}

/**
 * 外部数据访问统一封装（新增文件，不改动既有业务调用）。
 */
export const ExternalData = {
  /**
   * 执行外部命令（执行类能力）。
   */
  async execute(cmd: string): Promise<KsuExecResult> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);

      return {
        errno: 0,
        stdout: `[MOCK_EXEC] ${cmd}`,
        stderr: "",
      };
    }

    return ksuRun(cmd);
  },

  /**
   * 执行 meta-mm 子命令（执行类能力）。
   */
  async executeMetaMm(args: string): Promise<KsuExecResult> {
    const safeArgs = args.trim();

    return ExternalData.execute(
      `/data/adb/modules/magic_mount_rs/meta-mm ${safeArgs}`,
    );
  },

  /**
   * 本地存储：获取。
   */
  storageGet(key: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  },

  /**
   * 本地存储：设置/更新。
   */
  storageSet(key: string, value: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
  },

  /**
   * 本地存储：删除。
   */
  storageDelete(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },

  /**
   * 本地存储：JSON 合并更新。
   */
  storageUpdateJson<T extends Record<string, unknown>>(
    key: string,
    patch: Partial<T>,
    defaultValue: T,
  ): T {
    if (typeof window === "undefined") return { ...defaultValue, ...patch };
    const raw = localStorage.getItem(key);
    let base = defaultValue;

    if (raw) {
      try {
        base = JSON.parse(raw) as T;
      } catch {
        base = defaultValue;
      }
    }

    const next = { ...base, ...patch };
    localStorage.setItem(key, JSON.stringify(next));

    return next;
  },

  /**
   * 读取配置文件原文（获取类能力）。
   */
  async readConfigRaw(): Promise<string> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);
      return serializeKvConfig(DEFAULT_CONFIG);
    }

    try {
      const { errno, stdout } = await ksuRun(
        `[ -f "${PATHS.CONFIG}" ] && cat "${PATHS.CONFIG}" || echo ""`,
      );
      if (errno === 0) {
        return stdout ?? "";
      }
    } catch {}

    return "";
  },

  /**
   * 写入配置文件原文（设置/更新类能力）。
   */
  async writeConfigRaw(content: string): Promise<void> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);
      return;
    }

    const cmd = `
      mkdir -p "$(dirname "${PATHS.CONFIG}")"
      cat > "${PATHS.CONFIG}" << 'EOF_CONFIG'
${content}
EOF_CONFIG
      chmod 644 "${PATHS.CONFIG}"
    `;
    const { errno, stderr } = await ksuRun(cmd);
    if (errno !== 0) {
      throw new Error(`Failed to write config raw: ${stderr}`);
    }
  },

  /**
   * 删除配置文件（删除类能力）。
   */
  async deleteConfig(): Promise<void> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);
      return;
    }

    const { errno, stderr } = await ksuRun(`rm -f "${PATHS.CONFIG}"`);
    if (errno !== 0) {
      throw new Error(`Failed to delete config: ${stderr}`);
    }
  },

  /**
   * 增量更新配置（更新类能力）。
   */
  async patchConfig(partial: Partial<MagicConfig>): Promise<MagicConfig> {
    const base = await ExternalData.loadConfig();
    const next: MagicConfig = {
      ...base,
      ...partial,
      partitions: partial.partitions ?? base.partitions,
    };
    await ExternalData.saveConfig(next);

    return next;
  },

  async loadConfig(): Promise<MagicConfig> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);

      return {
        ...DEFAULT_CONFIG,
        mountsource: "KSU",
        umount: true,
        partitions: ["product", "system_ext", "vendor"],
      };
    }

    try {
      const { errno, stdout } = await ksuRun(
        `[ -f "${PATHS.CONFIG}" ] && cat "${PATHS.CONFIG}" || echo ""`,
      );
      if (errno === 0 && stdout.trim()) {
        return parseKvConfig(stdout);
      }
    } catch {}

    return { ...DEFAULT_CONFIG };
  },

  async saveConfig(config: MagicConfig): Promise<void> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);
      return;
    }

    const content = serializeKvConfig(config);
    const cmd = `
      mkdir -p "$(dirname "${PATHS.CONFIG}")"
      cat > "${PATHS.CONFIG}" << 'EOF_CONFIG'
${content}
EOF_CONFIG
      chmod 644 "${PATHS.CONFIG}"
    `;

    const { errno, stderr } = await ksuRun(cmd);
    if (errno !== 0) {
      throw new Error(`Failed to save config: ${stderr}`);
    }
  },

  async loadModules(): Promise<MagicModule[]> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);

      return [
        {
          id: "youtube-revanced",
          name: "YouTube ReVanced",
          version: "18.20.39",
          author: "ReVanced Team",
          description: "YouTube ReVanced Module",
          is_mounted: true,
          mode: "magic",
          rules: { default_mode: "magic", paths: {} },
        },
        {
          id: "lsposed",
          name: "LSPosed",
          version: "1.9.2",
          author: "LSPosed Team",
          description: "Xposed Framework for Android",
          is_mounted: true,
          mode: "magic",
          rules: { default_mode: "magic", paths: {} },
        },
        {
          id: "shamiko",
          name: "Shamiko",
          version: "0.7.5",
          author: "LSPosed Team",
          description: "Hide root from apps",
          is_mounted: false,
          mode: "magic",
          rules: { default_mode: "magic", paths: {} },
        },
        {
          id: "busybox-ndk",
          name: "Busybox NDK",
          version: "1.36.1",
          author: "osm0sis",
          description: "Busybox for Android NDK",
          is_mounted: true,
          mode: "magic",
          rules: { default_mode: "magic", paths: {} },
        },
      ];
    }

    try {
      const { errno, stdout } = await ksuRun(
        "/data/adb/modules/magic_mount_rs/meta-mm scan --json",
      );
      if (errno === 0 && stdout) {
        const raw = JSON.parse(stdout) as Array<Record<string, unknown>>;

        return raw.map((m) => ({
          id: String(m.id ?? ""),
          name: String(m.name ?? ""),
          version: String(m.version ?? ""),
          author: String(m.author ?? "Unknown"),
          description: String(m.description ?? ""),
          is_mounted: !Boolean(m.skip),
          mode: "magic",
          rules: { default_mode: "magic", paths: {} },
        }));
      }
    } catch {}

    return [];
  },

  async getStorageUsage(): Promise<StorageUsage> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);

      return {
        type: "ext4",
        percent: "42%",
        size: "118 GB",
        used: "50 GB",
      };
    }

    try {
      const { stdout } = await ksuRun("df -k /data/adb/modules | tail -n 1");
      if (stdout) {
        const parts = stdout.split(/\s+/);
        if (parts.length >= 6) {
          const total = Number.parseInt(parts[1]) * 1024;
          const used = Number.parseInt(parts[2]) * 1024;

          return {
            type: "ext4",
            percent: parts[4],
            size: formatBytes(total),
            used: formatBytes(used),
          };
        }
      }
    } catch {}

    return {
      size: "-",
      used: "-",
      percent: "0%",
      type: null,
    };
  },

  async getSystemInfo(): Promise<SystemInfo> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);

      return {
        kernel: "5.10.101-android12-mock",
        selinux: "Enforcing",
        mountBase: "/data/adb/modules",
        activeMounts: ["youtube-revanced", "lsposed", "shamiko", "busybox-ndk"],
      };
    }

    try {
      const cmd = `
        echo "KERNEL:$(uname -r)"
        echo "SELINUX:$(getenforce)"
      `;
      const { errno, stdout } = await ksuRun(cmd);
      const info: SystemInfo = {
        kernel: "-",
        selinux: "-",
        mountBase: "/data/adb/modules",
        activeMounts: [],
      };

      if (errno === 0 && stdout) {
        for (const line of stdout.split("\n")) {
          if (line.startsWith("KERNEL:")) {
            info.kernel = line.slice(7).trim();
          } else if (line.startsWith("SELINUX:")) {
            info.selinux = line.slice(8).trim();
          }
        }
      }

      const m = await ksuRun("ls -1 /data/adb/modules");
      if (m.errno === 0 && m.stdout) {
        info.activeMounts = m.stdout
          .split("\n")
          .filter((s) => s.trim() && s !== "magic_mount_rs");
      }

      return info;
    } catch {
      return {
        kernel: "-",
        selinux: "-",
        mountBase: "-",
        activeMounts: [],
      };
    }
  },

  async getDeviceStatus(): Promise<DeviceStatus> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);

      return {
        model: "Pixel 8 Pro (Mock)",
        android: "14",
        kernel: "See System Info",
        selinux: "See System Info",
      };
    }

    const { stdout } = await ksuRun(
      "getprop ro.product.model; getprop ro.build.version.release",
    );
    const lines = stdout ? stdout.split("\n") : [];

    return {
      model: lines[0] || "Unknown",
      android: lines[1] || "Unknown",
      kernel: "See System Info",
      selinux: "See System Info",
    };
  },

  async getVersion(): Promise<string> {
    if (await shouldUseMockMode()) {
      await delay(MOCK_DELAY_MS);
      return "1.2.0-mock";
    }

    try {
      const { errno, stdout } = await ksuRun(
        "/data/adb/modules/magic_mount_rs/meta-mm version",
      );
      if (errno === 0 && stdout) {
        const res = JSON.parse(stdout) as { version?: string };

        return res.version ?? "0.0.0";
      }
    } catch {}

    return "Unknown";
  },

  async openLink(url: string): Promise<void> {
    if (await shouldUseMockMode()) {
      window.open(url, "_blank");
      return;
    }

    const safeUrl = url.replace(/"/g, '\\"');
    await ksuRun(`am start -a android.intent.action.VIEW -d "${safeUrl}"`);
  },

  async reboot(): Promise<void> {
    if (await shouldUseMockMode()) {
      return;
    }

    await ksuRun("svc power reboot || reboot");
  },

  async loadStatusSnapshot(): Promise<StatusSnapshot> {
    const [device, version, storage, systemInfo] = await Promise.all([
      ExternalData.getDeviceStatus(),
      ExternalData.getVersion(),
      ExternalData.getStorageUsage(),
      ExternalData.getSystemInfo(),
    ]);

    return {
      device: {
        ...device,
        kernel: systemInfo.kernel,
        selinux: systemInfo.selinux,
      },
      version,
      storage,
      systemInfo,
      activePartitions: systemInfo.activeMounts || [],
    };
  },

  async fetchContributors(
    options: ContributorFetchOptions = {},
  ): Promise<ContributorProfile[]> {
    const owner = options.owner ?? DEFAULT_REPO_OWNER;
    const repo = options.repo ?? DEFAULT_REPO_NAME;
    const cacheKey = options.cacheKey ?? DEFAULT_CACHE_KEY;
    const cacheDurationMs = options.cacheDurationMs ?? DEFAULT_CACHE_DURATION_MS;

    const cached = readCache<ContributorProfile[]>(cacheKey, cacheDurationMs);
    if (cached) {
      return cached;
    }

    const profiles = await fetchContributorProfiles(owner, repo);
    writeCache(cacheKey, profiles);

    return profiles;
  },

  /**
   * 读取贡献者缓存（获取类能力）。
   */
  getContributorsCache(
    cacheKey = DEFAULT_CACHE_KEY,
    cacheDurationMs = DEFAULT_CACHE_DURATION_MS,
  ): ContributorProfile[] | null {
    return readCache<ContributorProfile[]>(cacheKey, cacheDurationMs);
  },

  /**
   * 清理贡献者缓存（删除类能力）。
   */
  clearContributorsCache(cacheKey = DEFAULT_CACHE_KEY): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(cacheKey);
  },
};
