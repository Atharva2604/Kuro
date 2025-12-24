import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Link, Lock, Clock } from "lucide-react";

const FRONTEND_URL = window.location.origin;

export default function ShareModal({ file, onClose }) {
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiryHours, setExpiryHours] = useState("24");

  const handleCreateLink = async () => {
    setLoading(true);
    try {
      const payload = {
        file_id: file.id,
        password: usePassword ? password : null,
        expires_in_hours: useExpiry ? parseInt(expiryHours) : null,
      };
      const response = await api.post("/share", payload);
      setShareLink(`${FRONTEND_URL}/shared/${response.data.token}`);
      toast.success("Share link created!");
    } catch (error) {
      toast.error("Failed to create share link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="rounded-none max-w-md" data-testid="share-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Share "{file.name}"
          </DialogTitle>
        </DialogHeader>

        {shareLink ? (
          <div className="space-y-4">
            <div className="bg-muted p-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Share Link
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="h-10 rounded-none border-2 mono text-sm"
                  data-testid="share-link-input"
                />
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="rounded-none px-3"
                  data-testid="copy-link-button"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              {usePassword && (
                <p className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password protected
                </p>
              )}
              {useExpiry && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Expires in {expiryHours} hours
                </p>
              )}
            </div>

            <DialogFooter>
              <Button onClick={onClose} className="rounded-none w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Password Protection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>Password Protection</Label>
                  <p className="text-xs text-muted-foreground">
                    Require password to access
                  </p>
                </div>
              </div>
              <Switch
                checked={usePassword}
                onCheckedChange={setUsePassword}
                data-testid="password-toggle"
              />
            </div>
            {usePassword && (
              <Input
                type="text"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 rounded-none border-2"
                data-testid="share-password-input"
              />
            )}

            {/* Expiry */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>Set Expiry</Label>
                  <p className="text-xs text-muted-foreground">
                    Link expires after time
                  </p>
                </div>
              </div>
              <Switch
                checked={useExpiry}
                onCheckedChange={setUseExpiry}
                data-testid="expiry-toggle"
              />
            </div>
            {useExpiry && (
              <Select value={expiryHours} onValueChange={setExpiryHours}>
                <SelectTrigger className="rounded-none border-2" data-testid="expiry-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-none flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateLink}
                disabled={loading || (usePassword && !password)}
                className="rounded-none flex-1"
                data-testid="create-share-link-button"
              >
                {loading ? "Creating..." : "Create Link"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
