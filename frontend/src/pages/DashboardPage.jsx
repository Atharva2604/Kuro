import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { api, uploadFile, formatFileSize } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sun,
  Moon,
  LogOut,
  FolderOpen,
  Share2,
  Activity,
  Settings,
  Shield,
  Upload,
  Menu,
  X,
  HardDrive,
} from "lucide-react";
import FilesView from "@/components/FilesView";
import SharedLinksView from "@/components/SharedLinksView";
import ActivityView from "@/components/ActivityView";
import AdminView from "@/components/AdminView";
import SettingsView from "@/components/SettingsView";

const navItems = [
  { path: "/dashboard", icon: FolderOpen, label: "My Files", testId: "nav-files" },
  { path: "/dashboard/shared", icon: Share2, label: "Shared Links", testId: "nav-shared" },
  { path: "/dashboard/activity", icon: Activity, label: "Activity", testId: "nav-activity" },
  { path: "/dashboard/settings", icon: Settings, label: "Settings", testId: "nav-settings" },
];

export default function DashboardPage() {
  const { user, logout, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const storageUsed = user?.storage_used || 0;
  const storageLimit = user?.storage_limit || 500 * 1024 * 1024;
  const storagePercent = Math.round((storageUsed / storageLimit) * 100);

  const handleFileUpload = useCallback(async (files) => {
    for (const file of files) {
      if (storageUsed + file.size > storageLimit) {
        toast.error(`Storage limit exceeded. Cannot upload ${file.name}`);
        continue;
      }

      try {
        setUploadProgress({ name: file.name, progress: 0 });
        await uploadFile(file, currentFolderId, (progress) => {
          setUploadProgress({ name: file.name, progress });
        });
        toast.success(`${file.name} uploaded successfully`);
        await refreshUser();
        setRefreshKey((k) => k + 1);
      } catch (error) {
        const message = error.response?.data?.detail || `Failed to upload ${file.name}`;
        toast.error(message);
      } finally {
        setUploadProgress(null);
      }
    }
  }, [currentFolderId, storageUsed, storageLimit, refreshUser]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && location.pathname === "/dashboard") {
      handleFileUpload(files);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
    toast.success("Logged out successfully");
  };

  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div
      className="min-h-screen flex noise-bg"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="dashboard-page"
    >
      {/* Mobile Sidebar Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden rounded-none"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        data-testid="mobile-menu-toggle"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-card border-r border-border transform transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <h1 className="text-2xl font-extrabold tracking-tight">KURO</h1>
            <p className="text-sm text-muted-foreground mt-1">Digital Vault</p>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  data-testid={item.testId}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              ))}
              {user?.role === "admin" && (
                <button
                  onClick={() => {
                    navigate("/dashboard/admin");
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive("/dashboard/admin")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  data-testid="nav-admin"
                >
                  <Shield className="h-5 w-5" />
                  Admin Panel
                </button>
              )}
            </nav>
          </ScrollArea>

          {/* Storage Usage */}
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Storage</span>
            </div>
            <Progress value={storagePercent} className="h-2" />
            <p className="text-xs text-muted-foreground mono">
              {formatFileSize(storageUsed)} / {formatFileSize(storageLimit)} used
            </p>
          </div>

          {/* User Section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="flex-1 rounded-none"
                data-testid="theme-toggle-sidebar"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                className="flex-1 rounded-none"
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Upload Progress Bar */}
        {uploadProgress && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border p-4 animate-slide-in">
            <div className="flex items-center gap-4 max-w-md mx-auto lg:mx-0 lg:ml-72">
              <Upload className="h-5 w-5 animate-pulse text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium truncate">{uploadProgress.name}</p>
                <Progress value={uploadProgress.progress} className="h-1 mt-1" />
              </div>
              <span className="text-sm text-muted-foreground mono">{uploadProgress.progress}%</span>
            </div>
          </div>
        )}

        {/* Drag Overlay */}
        {isDragging && location.pathname === "/dashboard" && (
          <div className="fixed inset-0 z-40 bg-primary/10 flex items-center justify-center pointer-events-none">
            <div className="bg-card border-2 border-dashed border-primary p-12 text-center">
              <Upload className="h-16 w-16 mx-auto text-primary mb-4" />
              <p className="text-xl font-bold">Drop files here</p>
              <p className="text-muted-foreground mt-2">Files will be uploaded to current folder</p>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6 lg:p-8 pt-16 lg:pt-8">
          <Routes>
            <Route
              path="/"
              element={
                <FilesView
                  refreshKey={refreshKey}
                  onUpload={handleFileUpload}
                  onFolderChange={setCurrentFolderId}
                />
              }
            />
            <Route path="/shared" element={<SharedLinksView />} />
            <Route path="/activity" element={<ActivityView />} />
            <Route path="/settings" element={<SettingsView />} />
            {user?.role === "admin" && <Route path="/admin" element={<AdminView />} />}
          </Routes>
        </div>
      </main>
    </div>
  );
}
