import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { formatFileSize } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download,
  Lock,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Code,
  File,
  Moon,
  Sun,
  AlertCircle,
  Clock,
} from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const fileIcons = {
  document: FileText,
  image: Image,
  video: Video,
  audio: Music,
  archive: Archive,
  code: Code,
  file: File,
};

export default function SharedFilePage() {
  const { token } = useParams();
  const { theme, toggleTheme } = useTheme();
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchFileInfo();
  }, [token]);

  const fetchFileInfo = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/shared/${token}`);
      setFileInfo(response.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError("This share link does not exist or has been removed.");
      } else if (err.response?.status === 410) {
        setError("This share link has expired.");
      } else {
        setError("Failed to load shared file information.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/shared/${token}/download`,
        { password: password || null },
        { responseType: "blob" }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileInfo.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Download started!");
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Invalid password");
      } else if (err.response?.status === 410) {
        toast.error("This share link has expired");
        setError("This share link has expired.");
      } else {
        toast.error("Download failed");
      }
    } finally {
      setDownloading(false);
    }
  };

  const FileIcon = fileIcons[fileInfo?.file_type] || File;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background noise-bg">
        <div className="animate-pulse text-lg font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background noise-bg" data-testid="shared-file-page">
      {/* Header */}
      <header className="glass-header p-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">KURO</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-none"
          data-testid="theme-toggle"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in-up">
          {error ? (
            <div className="bg-card border border-border p-8 text-center space-y-4">
              <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
              <h2 className="text-xl font-bold">Access Denied</h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="bg-card border border-border p-8 space-y-6">
              {/* File Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-muted flex items-center justify-center">
                  <FileIcon className={`h-8 w-8 file-type-${fileInfo.file_type}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold truncate">{fileInfo.file_name}</h2>
                  <p className="text-sm text-muted-foreground mono">
                    {formatFileSize(fileInfo.file_size)}
                  </p>
                </div>
              </div>

              {/* Expiry Info */}
              {fileInfo.expires_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3">
                  <Clock className="h-4 w-4" />
                  <span>
                    Expires: {new Date(fileInfo.expires_at).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Password Input */}
              {fileInfo.requires_password && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password Required
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-none border-2"
                    data-testid="password-input"
                  />
                </div>
              )}

              {/* Download Button */}
              <Button
                onClick={handleDownload}
                disabled={downloading || (fileInfo.requires_password && !password)}
                className="w-full h-12 rounded-none font-bold uppercase tracking-wide"
                data-testid="download-button"
              >
                {downloading ? (
                  "Downloading..."
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Download File
                  </>
                )}
              </Button>

              {/* Security Note */}
              <p className="text-xs text-center text-muted-foreground">
                Shared securely via Kuro Digital Vault
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
