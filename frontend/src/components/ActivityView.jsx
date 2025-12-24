import { useState, useEffect } from "react";
import { api, formatDate } from "@/lib/api";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Upload,
  Download,
  Trash2,
  FolderPlus,
  Share2,
  LogIn,
  UserPlus,
  Edit,
  FileText,
  Folder,
  User,
} from "lucide-react";

const actionIcons = {
  upload: Upload,
  download: Download,
  delete: Trash2,
  create: FolderPlus,
  share: Share2,
  unshare: Share2,
  login: LogIn,
  register: UserPlus,
  rename: Edit,
  move: Edit,
  update: Edit,
  shared_download: Download,
};

const resourceIcons = {
  file: FileText,
  folder: Folder,
  user: User,
  account: User,
};

const actionColors = {
  upload: "text-green-500",
  download: "text-blue-500",
  delete: "text-red-500",
  create: "text-amber-500",
  share: "text-purple-500",
  unshare: "text-purple-500",
  login: "text-primary",
  register: "text-primary",
  rename: "text-orange-500",
  move: "text-orange-500",
  update: "text-orange-500",
  shared_download: "text-blue-500",
};

export default function ActivityView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    try {
      const response = await api.get("/activity", { params: { limit: 100 } });
      setLogs(response.data);
    } catch (error) {
      toast.error("Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="activity-view">
      <div>
        <h2 className="text-2xl font-bold">Activity Log</h2>
        <p className="text-muted-foreground mt-1">
          Track all your file operations
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border">
          <Activity className="h-20 w-20 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-bold mb-2">No activity yet</h3>
          <p className="text-muted-foreground">
            Your file operations will appear here
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-250px)]">
          <div className="space-y-2 pr-4">
            {logs.map((log, index) => {
              const ActionIcon = actionIcons[log.action] || Activity;
              const ResourceIcon = resourceIcons[log.resource_type] || FileText;
              const actionColor = actionColors[log.action] || "text-muted-foreground";

              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-4 p-4 bg-card border border-border hover:border-primary/50 transition-colors animate-fade-in-up stagger-${(index % 5) + 1}`}
                  data-testid={`activity-${log.id}`}
                >
                  <div className={`p-2 bg-muted rounded-sm ${actionColor}`}>
                    <ActionIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      <span className="capitalize">{log.action}</span>
                      <span className="text-muted-foreground"> {log.resource_type} </span>
                    </p>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-2 mt-1">
                      <ResourceIcon className="h-4 w-4 flex-shrink-0" />
                      {log.resource_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm text-muted-foreground mono">
                      {formatDate(log.created_at)}
                    </p>
                    {log.ip_address !== "unknown" && (
                      <p className="text-xs text-muted-foreground/70 mono mt-1">
                        {log.ip_address}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
