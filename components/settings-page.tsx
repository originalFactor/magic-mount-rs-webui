"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Github,
  ExternalLink,
  HardDrive,
  Layers,
  Power,
  Save,
  User,
  Loader2,
  X,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalData,
  type MagicConfig,
  type ContributorProfile,
} from "@/lib/external-data";

const MOUNT_SOURCES = ["KSU", "APatch", "Magisk"];
const GITHUB_REPO_URL = "https://github.com/Tools-cx-app/meta-magic_mount-rs";

export function SettingsPage() {
  const [config, setConfig] = useState<MagicConfig | null>(null);
  const [contributors, setContributors] = useState<ContributorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPartition, setNewPartition] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [configData, contributorsData] = await Promise.all([
        ExternalData.loadConfig(),
        ExternalData.fetchContributors(),
      ]);
      setConfig(configData);
      setContributors(contributorsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      await ExternalData.saveConfig(config);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<MagicConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
    setHasChanges(true);
  };

  const addPartition = () => {
    if (!config || !newPartition.trim()) return;
    if (config.partitions.includes(newPartition.trim())) return;

    updateConfig({
      partitions: [...config.partitions, newPartition.trim()],
    });
    setNewPartition("");
  };

  const removePartition = (partition: string) => {
    if (!config) return;
    updateConfig({
      partitions: config.partitions.filter((p) => p !== partition),
    });
  };

  const handleContributorClick = async (contributor: ContributorProfile) => {
    await ExternalData.openLink(contributor.html_url);
  };

  const handleGithubClick = async () => {
    await ExternalData.openLink(GITHUB_REPO_URL);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">设置</h1>
          <p className="text-sm text-muted-foreground">配置 Magic Mount Rs</p>
        </div>
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存
          </Button>
        )}
      </div>

      {/* Mount Source */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <HardDrive className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold">挂载源</CardTitle>
            <p className="text-xs text-muted-foreground">
              选择模块挂载的来源
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Select
            value={config?.mountsource ?? "KSU"}
            onValueChange={(value) => updateConfig({ mountsource: value })}
          >
            <SelectTrigger className="w-full border-border bg-secondary">
              <SelectValue placeholder="选择挂载源" />
            </SelectTrigger>
            <SelectContent>
              {MOUNT_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Extra Partitions */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold">额外分区</CardTitle>
            <p className="text-xs text-muted-foreground">
              添加需要挂载的额外分区
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Add Partition */}
          <div className="mb-3 flex gap-2">
            <Input
              type="text"
              placeholder="输入分区名称..."
              value={newPartition}
              onChange={(e) => setNewPartition(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPartition()}
              className="h-9 flex-1 border-border bg-secondary text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={addPartition}
              disabled={!newPartition.trim()}
              className="h-9 px-3"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Partition List */}
          {config && config.partitions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {config.partitions.map((partition) => (
                <Badge
                  key={partition}
                  variant="secondary"
                  className="group flex items-center gap-1 font-mono text-xs"
                >
                  {partition}
                  <button
                    onClick={() => removePartition(partition)}
                    className="ml-1 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              暂无额外分区
            </p>
          )}
        </CardContent>
      </Card>

      {/* Enable Unmount */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Power className="h-5 w-5" />
            </div>
            <div>
              <Label className="text-base font-semibold">启用卸载</Label>
              <p className="text-xs text-muted-foreground">
                允许卸载已挂载的模块
              </p>
            </div>
          </div>
          <Switch
            checked={config?.umount ?? true}
            onCheckedChange={(checked) => updateConfig({ umount: checked })}
          />
        </CardContent>
      </Card>

      {/* GitHub Link */}
      <Card
        className="cursor-pointer border-border bg-card transition-colors hover:bg-card/80"
        onClick={handleGithubClick}
      >
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">GitHub 仓库</p>
              <p className="text-xs text-muted-foreground">
                查看源代码和文档
              </p>
            </div>
          </div>
          <ExternalLink className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Contributors */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <User className="h-4 w-4" />
            贡献者
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {contributors.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              加载中...
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {contributors.map((contributor) => (
                <button
                  key={contributor.id}
                  onClick={() => handleContributorClick(contributor)}
                  className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-secondary"
                >
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage
                      src={contributor.avatar_url}
                      alt={contributor.login}
                    />
                    <AvatarFallback className="bg-secondary text-foreground">
                      {contributor.login.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {contributor.name || contributor.login}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{contributor.login}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
