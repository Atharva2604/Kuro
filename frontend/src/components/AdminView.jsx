import { useState, useEffect } from "react";
import { api, formatFileSize, formatDate } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Users,
  HardDrive,
  FileText,
  Folder,
  Trash2,
  Crown,
  Activity,
} from "lucide-react";

export default function AdminView() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteUser, setDeleteUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}`, { role: newRole });
      toast.success("User role updated");
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (error) {
      toast.error("Failed to update role");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    try {
      await api.delete(`/admin/users/${deleteUser.id}`);
      toast.success("User deleted");
      setUsers(users.filter((u) => u.id !== deleteUser.id));
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to delete user";
      toast.error(message);
    } finally {
      setDeleteUser(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="admin-view">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Admin Panel</h2>
          <p className="text-muted-foreground">
            System overview and user management
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-6 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-5 w-5" />
            <span className="text-sm uppercase tracking-wide">Users</span>
          </div>
          <p className="text-3xl font-bold">{stats?.total_users || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-5 w-5" />
            <span className="text-sm uppercase tracking-wide">Files</span>
          </div>
          <p className="text-3xl font-bold">{stats?.total_files || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Folder className="h-5 w-5" />
            <span className="text-sm uppercase tracking-wide">Folders</span>
          </div>
          <p className="text-3xl font-bold">{stats?.total_folders || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HardDrive className="h-5 w-5" />
            <span className="text-sm uppercase tracking-wide">Storage</span>
          </div>
          <p className="text-3xl font-bold mono">
            {formatFileSize(stats?.total_storage_used || 0)}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Management
        </h3>
        <div className="border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead className="hidden sm:table-cell">Role</TableHead>
                <TableHead className="hidden md:table-cell">Storage</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const storagePercent = Math.round(
                  (user.storage_used / user.storage_limit) * 100
                );
                return (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {user.name}
                            {user.role === "admin" && (
                              <Crown className="h-4 w-4 text-amber-500" />
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-24 h-8 rounded-none text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-1 w-32">
                        <Progress value={storagePercent} className="h-1" />
                        <p className="text-xs text-muted-foreground mono">
                          {formatFileSize(user.storage_used)} / {formatFileSize(user.storage_limit)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground mono text-sm">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteUser(user)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent System Activity
        </h3>
        <ScrollArea className="h-64 border border-border">
          <div className="p-4 space-y-2">
            {stats?.recent_activity?.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{log.user_name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      {log.action} {log.resource_type}{" "}
                    </span>
                    <span className="truncate">{log.resource_name}</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mono ml-4">
                  {formatDate(log.created_at)}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user "{deleteUser?.name}" and all their
              files, folders, and share links. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
