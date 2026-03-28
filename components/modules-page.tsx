"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Package, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ExternalData, type MagicModule } from "@/lib/external-data";

export function ModulesPage() {
  const [modules, setModules] = useState<MagicModule[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const data = await ExternalData.loadModules();
        setModules(data);
      } catch (error) {
        console.error("Failed to fetch modules:", error);
      }
    };

    fetchModules();
  }, []);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;

    const query = searchQuery.toLowerCase();
    return modules.filter(
      (module) =>
        module.name.toLowerCase().includes(query) ||
        module.id.toLowerCase().includes(query) ||
        module.author.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query)
    );
  }, [modules, searchQuery]);

  return (
    <div className="flex flex-col gap-4 p-4 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">模块</h1>
        <p className="text-sm text-muted-foreground">
          共 {modules.length} 个模块
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="搜索模块..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 border-border bg-card pl-9 text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Module List */}
      {filteredModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Package className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? "未找到匹配的模块" : "暂无模块"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleCard({ module }: { module: MagicModule }) {
  return (
    <Card className="overflow-hidden border-border bg-card transition-colors hover:bg-card/80">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              module.is_mounted
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Package className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-foreground">
                  {module.name}
                </h3>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {module.id}
                </p>
              </div>

              {/* Status */}
              <div className="shrink-0">
                {module.is_mounted ? (
                  <div className="flex items-center gap-1 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-medium">已挂载</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">未挂载</span>
                  </div>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-border font-mono text-xs"
              >
                v{module.version}
              </Badge>
              <span className="text-xs text-muted-foreground">
                by {module.author}
              </span>
            </div>

            {/* Description */}
            {module.description && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {module.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
