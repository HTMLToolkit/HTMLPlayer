import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../primitives/Dialog";
import { Button } from "../primitives/Button";
import { Input } from "../primitives/Input";
import modalStyles from "../../primitives/Dialog.module.css";
import type { Playlist, PlaylistFolder } from "../../../core/engine/types";

export type DialogType = "createPlaylist" | "createFolder" | "delete" | "rename" | "move" | "confirm";

interface ConfirmDialogProps {
  type: DialogType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Playlist | PlaylistFolder | null;
  folders?: { folder: PlaylistFolder; path: string[] }[];
  onConfirm: (value?: string | null) => void;
  onCancel?: () => void;
}

export function ConfirmDialog({
  type,
  open,
  onOpenChange,
  item,
  folders = [],
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(item?.name || "");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (type === "move" && selectedFolderId !== null) {
      onConfirm(selectedFolderId);
    } else {
      onConfirm(value);
    }
    setValue(item?.name || "");
    setSelectedFolderId(null);
  };

  const handleCancel = () => {
    setValue(item?.name || "");
    setSelectedFolderId(null);
    onCancel?.();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleCancel();
    } else {
      onOpenChange(true);
    }
  };

  const titles: Record<DialogType, string> = {
    createPlaylist: t("playlist.createPlaylist"),
    createFolder: t("playlist.createFolder"),
    delete: item && "songs" in item ? t("playlist.deletePlaylist") : t("playlist.deleteFolder"),
    rename: item && "songs" in item ? t("playlist.renamePlaylist") : t("playlist.renameFolder"),
    move: t("playlist.moveToFolder"),
    confirm: t("common.confirm"),
  };

  const descriptions: Record<DialogType, string> = {
    createPlaylist: t("playlist.enterPlaylistName"),
    createFolder: t("playlist.enterFolderName"),
    delete: item ? t("playlist.deleteConfirmation", { name: item.name }) : "",
    rename: t("playlist.enterNewName"),
    move: item ? t("playlist.selectFolderToMove", { item: item.name }) : "",
    confirm: "",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dontShowAgainKey={type === "delete" ? "delete-playlist-confirmation" : undefined}>
        <DialogHeader>
          <DialogTitle>{titles[type]}</DialogTitle>
          <DialogDescription>{descriptions[type]}</DialogDescription>
        </DialogHeader>

        {(type === "createPlaylist" || type === "createFolder" || type === "rename") && (
          <div style={{ margin: "var(--spacing-4) 0" }}>
            <Input
              placeholder={type === "createPlaylist" ? t("playlist.enterPlaylistName") : t("playlist.folderName")}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" && value.trim()) handleConfirm();
              }}
              autoFocus
            />
          </div>
        )}

        {type === "move" && (
          <div className={modalStyles.spaceY4}>
            <Button
              variant="outline"
              className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
              onClick={() => {
                onConfirm(null);
                setSelectedFolderId(null);
                onOpenChange(false);
              }}
            >
              📁 {t("playlist.moveToRoot")}
            </Button>
            {folders.map(({ folder, path }) => (
              <Button
                key={folder.id}
                variant="outline"
                className={`${modalStyles["w-full"]} ${modalStyles["justify-start"]}`}
                onClick={() => {
                  onConfirm(folder.id);
                  onOpenChange(false);
                }}
              >
                {path.length > 0 ? `${path.join(" / ")} / ${folder.name}` : folder.name}
              </Button>
            ))}
          </div>
        )}

        {type !== "move" && (
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={type !== "delete" && !value.trim()}
              variant={type === "delete" ? "destructive" : "primary"}
            >
              {type === "delete" ? t("common.delete") : type === "rename" ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
