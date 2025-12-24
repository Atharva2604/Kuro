import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function FilePreview({ file, onClose }) {
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("kuro-token");
  
  const previewUrl = `${BACKEND_URL}/api/files/${file.id}/preview`;

  const handleDownload = async () => {
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
      console.error("Download failed:", error);
    }
  };

  const isImage = file.type === "image";
  const isPdf = file.name.toLowerCase().endsWith(".pdf");

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="rounded-none max-w-4xl max-h-[90vh]" data-testid="file-preview-modal">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle className="truncate flex-1">{file.name}</DialogTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleDownload}
              className="rounded-none"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative min-h-[400px] max-h-[70vh] overflow-auto bg-muted flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="animate-pulse">Loading preview...</div>
            </div>
          )}

          {isImage ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="max-w-full max-h-[70vh] object-contain"
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              style={{
                display: loading ? "none" : "block",
              }}
            />
          ) : isPdf ? (
            <iframe
              src={`${previewUrl}#toolbar=0`}
              className="w-full h-[70vh]"
              title={file.name}
              onLoad={() => setLoading(false)}
            />
          ) : (
            <div className="text-center p-8">
              <p className="text-muted-foreground">
                Preview not available for this file type
              </p>
              <Button onClick={handleDownload} className="mt-4 rounded-none">
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
