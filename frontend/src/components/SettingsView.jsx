import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { formatFileSize } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  User,
  HardDrive,
  Moon,
  Sun,
  Shield,
  Mail,
  Calendar,
} from "lucide-react";

export default function SettingsView() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const storageUsed = user?.storage_used || 0;
  const storageLimit = user?.storage_limit || 500 * 1024 * 1024;
  const storagePercent = Math.round((storageUsed / storageLimit) * 100);

  return (
    <div className="space-y-8 max-w-2xl" data-testid="settings-view">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account preferences
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <div className="bg-card border border-border p-6 space-y-6">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </h3>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-bold">{user?.name}</p>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Mail className="h-4 w-4" />
              {user?.email}
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Role
            </Label>
            <p className="font-medium flex items-center gap-2 mt-1">
              <Shield className="h-4 w-4" />
              <span className="capitalize">{user?.role}</span>
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Member Since
            </Label>
            <p className="font-medium flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" />
              {new Date(user?.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Storage Section */}
      <div className="bg-card border border-border p-6 space-y-6">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Used</span>
            <span className="font-medium mono">{formatFileSize(storageUsed)}</span>
          </div>
          <Progress value={storagePercent} className="h-3" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium mono">{formatFileSize(storageLimit)}</span>
          </div>
        </div>

        <div className="p-4 bg-muted text-sm">
          <p className="text-muted-foreground">
            {storagePercent < 80 ? (
              <>You have plenty of storage space remaining.</>
            ) : storagePercent < 95 ? (
              <>You're running low on storage. Consider deleting unused files.</>
            ) : (
              <>You're almost out of storage! Delete files to free up space.</>
            )}
          </p>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="bg-card border border-border p-6 space-y-6">
        <h3 className="text-lg font-bold flex items-center gap-2">
          {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          Appearance
        </h3>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Dark Mode</Label>
            <p className="text-sm text-muted-foreground">
              Switch between light and dark themes
            </p>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={toggleTheme}
            data-testid="theme-switch"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => theme !== "light" && toggleTheme()}
            className={`p-4 border-2 transition-colors ${
              theme === "light"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="w-full h-20 bg-white border border-gray-200 mb-3 flex items-center justify-center">
              <Sun className="h-8 w-8 text-gray-900" />
            </div>
            <p className="text-sm font-medium">Light</p>
          </button>
          <button
            onClick={() => theme !== "dark" && toggleTheme()}
            className={`p-4 border-2 transition-colors ${
              theme === "dark"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="w-full h-20 bg-zinc-900 border border-zinc-700 mb-3 flex items-center justify-center">
              <Moon className="h-8 w-8 text-white" />
            </div>
            <p className="text-sm font-medium">Dark</p>
          </button>
        </div>
      </div>
    </div>
  );
}
