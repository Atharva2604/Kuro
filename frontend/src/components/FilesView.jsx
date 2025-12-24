import { useState, useEffect, useRef } from "react";
import { api, formatFileSize, formatDate, getFileIcon } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  FolderPlus,
  Search,
  Grid,
  List,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Folder,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Code,
  File,
  ChevronRight,
  Home,
  FolderOpen,
  X,
  Eye,
} from "lucide-react";
import ShareModal from "./ShareModal";
import FilePreview from "./FilePreview";

const fileIcons = {
  document: FileText,
  spreadsheet: FileText,
  presentation: FileText,
  image: Image,
  video: Video,
  audio: Music,
  archive: Archive,
  code: Code,
  file: File,
};

export default function FilesView({ refreshKey, onUpload, onFolderChange }) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [shareModalFile, setShareModalFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [currentFolder, refreshKey]);

  useEffect(() => {
    onFolderChange?.(currentFolder);
  }, [currentFolder, onFolderChange]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchFiles();
    } else {
      setSearchResults(null);
    }
  }, [searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        api.get("/files", { params: { folder_id: currentFolder } }),
        api.get("/folders", { params: { parent_id: currentFolder } }),
      ]);
      setFiles(filesRes.data);
      setFolders(foldersRes.data);
    } catch (error) {
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const searchFiles = async () => {
    try {
      const response = await api.get("/files/search", { params: { q: searchQuery } });
      setSearchResults(response.data);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
    }
    e.target.value = "";
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await api.post("/folders", {
        name: newFolderName.trim(),
        parent_id: currentFolder,
      });
      toast.success("Folder created");
      setNewFolderDialog(false);
      setNewFolderName("");
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to create folder";
      toast.error(message);
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!window.confirm(`Delete folder "${folder.name}" and all its contents?`)) return;

    try {
      await api.delete(`/folders/${folder.id}`);
      toast.success("Folder deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete folder");
    }
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Delete "${file.name}"?`)) return;

    try {
      await api.delete(`/files/${file.id}`);
      toast.success("File deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      const response = await api.get(`/files/${file.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Download failed");
    }
  };

  const navigateToFolder = (folder) => {
    if (folder) {
      setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
      setCurrentFolder(folder.id);
    } else {
      setFolderPath([]);
      setCurrentFolder(null);
    }
    setSearchQuery("");
    setSearchResults(null);
  };

  const navigateToBreadcrumb = (index) => {
    if (index === -1) {
      setFolderPath([]);
      setCurrentFolder(null);
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setCurrentFolder(newPath[newPath.length - 1].id);
    }
    setSearchQuery("");
    setSearchResults(null);
  };

  const displayFiles = searchResults || files;
  const displayFolders = searchResults ? [] : folders;
  const FileIcon = (type) => fileIcons[type] || File;

  return (
    <div className="space-y-6" data-testid="files-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Files</h2>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mt-2 text-sm">
            <button
              onClick={() => navigateToBreadcrumb(-1)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="breadcrumb-home"
            >
              <Home className="h-4 w-4" />
              Home
            </button>
            {folderPath.map((folder, index) => (
              <span key={folder.id} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`hover:text-foreground transition-colors ${
                    index === folderPath.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setNewFolderDialog(true)}
            variant="outline"
            className="rounded-none"
            data-testid="new-folder-button"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-none"
            data-testid="upload-button"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Search & View Toggle */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-none border-2"
            data-testid="search-input"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex border-2 border-input">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            className="rounded-none"
            data-testid="grid-view-button"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
            className="rounded-none"
            data-testid="list-view-button"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse" />
          ))}
        </div>
      ) : displayFolders.length === 0 && displayFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="h-20 w-20 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-bold mb-2">
            {searchQuery ? "No results found" : "No files yet"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery
              ? "Try a different search term"
              : "Upload files or create a folder to get started"}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-none"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload your first file
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Folders */}
          {displayFolders.map((folder, index) => (
            <div
              key={folder.id}
              className={`group bg-card border border-border p-4 hover:border-primary transition-all duration-200 cursor-pointer animate-fade-in-up stagger-${(index % 5) + 1}`}
              onClick={() => navigateToFolder(folder)}
              data-testid={`folder-${folder.id}`}
            >
              <div className="flex justify-between items-start">
                <Folder className="h-10 w-10 text-primary" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-none">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="mt-3 text-sm font-medium truncate">{folder.name}</p>
              <p className="text-xs text-muted-foreground mono mt-1">
                {formatDate(folder.created_at)}
              </p>
            </div>
          ))}

          {/* Files */}
          {displayFiles.map((file, index) => {
            const Icon = FileIcon(file.type);
            return (
              <div
                key={file.id}
                className={`group bg-card border border-border p-4 hover:border-primary transition-all duration-200 animate-fade-in-up stagger-${((displayFolders.length + index) % 5) + 1}`}
                data-testid={`file-${file.id}`}
              >
                <div className="flex justify-between items-start">
                  <Icon className={`h-10 w-10 file-type-${file.type}`} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-none">
                      {["image", "document"].includes(file.type) && (
                        <DropdownMenuItem onClick={() => setPreviewFile(file)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShareModalFile(file)}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteFile(file)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="mt-3 text-sm font-medium truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground mono mt-1">
                  {formatFileSize(file.size)}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="border border-border divide-y divide-border">
          {/* Folders */}
          {displayFolders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigateToFolder(folder)}
              data-testid={`folder-list-${folder.id}`}
            >
              <Folder className="h-6 w-6 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{folder.name}</p>
              </div>
              <p className="text-sm text-muted-foreground mono hidden sm:block">
                {formatDate(folder.created_at)}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-none">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {/* Files */}
          {displayFiles.map((file) => {
            const Icon = FileIcon(file.type);
            return (
              <div
                key={file.id}
                className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                data-testid={`file-list-${file.id}`}
              >
                <Icon className={`h-6 w-6 file-type-${file.type} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mono sm:hidden">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mono hidden sm:block w-20 text-right">
                  {formatFileSize(file.size)}
                </p>
                <p className="text-sm text-muted-foreground mono hidden md:block w-24">
                  {formatDate(file.created_at)}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-none">
                    {["image", "document"].includes(file.type) && (
                      <DropdownMenuItem onClick={() => setPreviewFile(file)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShareModalFile(file)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDeleteFile(file)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialog} onOpenChange={setNewFolderDialog}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="h-12 rounded-none border-2"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            data-testid="folder-name-input"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewFolderDialog(false)}
              className="rounded-none"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} className="rounded-none" data-testid="create-folder-submit">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      {shareModalFile && (
        <ShareModal file={shareModalFile} onClose={() => setShareModalFile(null)} />
      )}

      {/* Preview Modal */}
      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
