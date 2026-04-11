import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { Button } from "./Button";
import { dialogStorage } from "../../../platform/storage";
import { toast } from "sonner";

interface ResetDialogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetDialogsDialog({
  open,
  onOpenChange,
}: ResetDialogsDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    try {
      await dialogStorage.resetAll();
      toast.success(t("settings.resetDialogsSuccess"));
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("settings.resetError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.resetDialogsTitle")}</DialogTitle>
          <DialogDescription>
            {t("settings.resetDialogsDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleReset}
            disabled={loading}
            variant="destructive"
          >
            {loading ? t("common.loading") : t("common.reset")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
