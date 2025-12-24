import { useState, useEffect } from "react";
import { api, formatDate } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Share2, Copy, Trash2, ExternalLink, Lock, Clock, Check, Eye } from "lucide-react";

const FRONTEND_URL = window.location.origin;

export default function SharedLinksView() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteLink, setDeleteLink] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const response = await api.get("/share");
      setLinks(response.data);
    } catch (error) {
      toast.error("Failed to load shared links");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (link) => {
    const url = `${FRONTEND_URL}/shared/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    toast.success("Link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async () => {
    if (!deleteLink) return;
    try {
      await api.delete(`/share/${deleteLink.id}`);
      toast.success("Share link deleted");
      setLinks(links.filter((l) => l.id !== deleteLink.id));
    } catch (error) {
      toast.error("Failed to delete link");
    } finally {
      setDeleteLink(null);
    }
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse" />
        <div className="h-64 bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="shared-links-view">
      <div>
        <h2 className="text-2xl font-bold">Shared Links</h2>
        <p className="text-muted-foreground mt-1">
          Manage your shared file links
        </p>
      </div>

      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border">
          <Share2 className="h-20 w-20 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-bold mb-2">No shared links</h3>
          <p className="text-muted-foreground">
            Share a file from the Files view to create a link
          </p>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>File</TableHead>
                <TableHead className="hidden sm:table-cell">Protection</TableHead>
                <TableHead className="hidden md:table-cell">Views</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden lg:table-cell">Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id} data-testid={`share-link-${link.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {isExpired(link.expires_at) && (
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5">
                          Expired
                        </span>
                      )}
                      <span className="truncate max-w-[200px]">{link.file_id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      {link.has_password && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Password
                        </span>
                      )}
                      {link.expires_at && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> Timed
                        </span>
                      )}
                      {!link.has_password && !link.expires_at && (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex items-center gap-1 mono text-sm">
                      <Eye className="h-3 w-3" /> {link.access_count}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground mono text-sm">
                    {formatDate(link.created_at)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground mono text-sm">
                    {link.expires_at
                      ? new Date(link.expires_at).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(link)}
                        className="h-8 w-8"
                        data-testid={`copy-link-${link.id}`}
                      >
                        {copiedId === link.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          window.open(`${FRONTEND_URL}/shared/${link.token}`, "_blank")
                        }
                        className="h-8 w-8"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteLink(link)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        data-testid={`delete-link-${link.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLink} onOpenChange={() => setDeleteLink(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete share link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this share link. Anyone with the link will
              no longer be able to access the file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
