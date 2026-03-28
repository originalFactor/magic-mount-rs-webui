"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Smartphone,
  Cpu,
  Shield,
  HardDrive,
  Layers,
  Package,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalData,
  type StatusSnapshot,
  type MagicConfig,
} from "@/lib/external-data";

export function HomePage() {
  const [status, setStatus] = useState<StatusSnapshot | null>(null);
  const [config, setConfig] = useState<MagicConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [statusData, configData] = await Promise.all([
        ExternalData.loadStatusSnapshot(),
        ExternalData.loadConfig(),
      ]);
      setStatus(statusData);
      setConfig(configData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // 定期刷新数据 (每30秒)
    const interval = setInterval(() => {
      fetchData(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const activeModulesCount = status?.activePartitions?.length ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Magic Mount Rs</h1>
          <p className="text-sm text-muted-foreground">
            版本 {status?.version ?? "-"}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw
            className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Device Card */}
      <Card className="overflow-hidden border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">设备信息</CardTitle>
            <p className="text-sm text-muted-foreground">
              {status?.device.model ?? "未知设备"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary hover:bg-primary/15"
            >
              Android {status?.device.android ?? "-"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Active Modules */}
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center p-4">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Package className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {activeModulesCount}
            </p>
            <p className="text-xs text-muted-foreground">活动模块</p>
          </CardContent>
        </Card>

        {/* Mount Source */}
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center p-4">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
              <HardDrive className="h-6 w-6" />
            </div>
            <p className="text-xl font-bold text-foreground">
              {config?.mountsource ?? "-"}
            </p>
            <p className="text-xs text-muted-foreground">挂载源</p>
          </CardContent>
        </Card>
      </div>

      {/* Storage Usage */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold">存储使用</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {status?.storage.type ?? "ext4"}
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">已用</span>
            <span className="font-medium text-foreground">
              {status?.storage.used ?? "-"} / {status?.storage.size ?? "-"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{
                width: status?.storage.percent ?? "0%",
              }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {status?.storage.percent ?? "0%"}
          </p>
        </CardContent>
      </Card>

      {/* System Details */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">系统详情</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-3">
            {/* Kernel */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Cpu className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">内核版本</p>
                <p className="truncate text-sm font-medium text-foreground">
                  {status?.device.kernel ?? "-"}
                </p>
              </div>
            </div>

            {/* SELinux */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Shield className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">SELinux 状态</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {status?.device.selinux ?? "-"}
                  </p>
                  {status?.device.selinux === "Enforcing" && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              </div>
            </div>

            {/* Mount Base */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <HardDrive className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">挂载路径</p>
                <p className="truncate font-mono text-sm text-foreground">
                  {status?.systemInfo.mountBase ?? "-"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Partitions */}
      {config && config.partitions.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              额外分区
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {config.partitions.map((partition) => (
                <Badge
                  key={partition}
                  variant="secondary"
                  className="font-mono text-xs"
                >
                  {partition}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
