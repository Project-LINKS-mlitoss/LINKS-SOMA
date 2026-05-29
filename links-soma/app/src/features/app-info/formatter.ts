// バイト数を人間が読みやすい形式に変換
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
};

export const formatters = {
  memory: formatBytes,
  fileSize: formatBytes,

  date: (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  },

  percentage: (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  },

  platform: (platform: string): string => {
    const platformNames: Record<string, string> = {
      win32: "Windows",
      darwin: "macOS",
      linux: "Linux",
      freebsd: "FreeBSD",
      openbsd: "OpenBSD",
      aix: "AIX",
      android: "Android",
      sunos: "Solaris",
    };
    return platformNames[platform] || platform;
  },

  architecture: (arch: string): string => {
    const archNames: Record<string, string> = {
      x64: "x64 (64-bit)",
      ia32: "x86 (32-bit)",
      arm: "ARM",
      arm64: "ARM64",
      s390: "System z",
      s390x: "System z (64-bit)",
      mips: "MIPS",
      mipsel: "MIPS (little endian)",
      ppc: "PowerPC",
      ppc64: "PowerPC (64-bit)",
    };
    return archNames[arch] || arch;
  },
};
