import React, { useState, useCallback, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { logger } from "../../../helpers/logger";
import { prefersReducedMotion } from "../../../helpers/reducedMotion";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  CollisionDetection,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import type { Data as DraggableData } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Icon } from "../shared/Icon";
import dragStyles from "./Draggable.module.css";
import { useTranslation } from "react-i18next";

export interface DragItem {
  id: string;
  type: "song" | "playlist" | "folder";
  data: DraggableData | undefined;
}

export interface DropZone {
  id: string;
  type: "playlist" | "folder" | "root" | "song";
  data: DraggableData | undefined;
}

export type DragOperationHandler = (
  dragItem: DragItem,
  dropZone: DropZone,
) => void;

interface DraggableProviderProps {
  children: React.ReactNode;
  onDragOperation?: DragOperationHandler;
}

interface DraggableItemProps {
  id: string;
  type: "song" | "playlist" | "folder";
  data: DraggableData;
  children:
    React.ReactNode | ((dragHandleProps: DragHandleProps) => React.ReactNode);
  disabled?: boolean;
  useDragHandle?: boolean;
}

export interface DragHandleProps {
  listeners: ReturnType<typeof useDraggable>["listeners"];
  attributes: ReturnType<typeof useDraggable>["attributes"];
}

interface DropZoneProps {
  id: string;
  type: "playlist" | "folder" | "root" | "song";
  data: DraggableData;
  children: React.ReactNode;
  className?: string;
}

const DragContext = React.createContext<{
  activeItem: DragItem | null;
}>({
  activeItem: null,
});

const customCollisionDetection: CollisionDetection = (args) => {
  let intersections = pointerWithin(args);

  if (!intersections || intersections.length === 0) {
    intersections = closestCenter(args);
  }

  if (!intersections || !intersections.length) return intersections || [];

  const songIntersections = intersections.filter((intersection) =>
    intersection.id.toString().startsWith("song::"),
  );

  const playlistIntersections = intersections.filter((intersection) =>
    intersection.id.toString().startsWith("playlist::"),
  );

  if (songIntersections.length > 0 && playlistIntersections.length > 0) {
    const { pointerCoordinates } = args;

    if (pointerCoordinates) {
      if (pointerCoordinates.x < 350) {
        return playlistIntersections;
      }

      return songIntersections;
    }
  }

  return intersections;
};

gsap.registerPlugin(useGSAP);

export const DraggableProvider: React.FC<DraggableProviderProps> = ({
  children,
  onDragOperation,
}) => {
  const { t } = useTranslation();
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const preview = previewRef.current;
      if (!preview || prefersReducedMotion()) return;
      const glow = getComputedStyle(preview)
        .getPropertyValue("--themecolor2-transparent")
        .trim();
      gsap.fromTo(
        preview,
        { boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)" },
        {
          boxShadow: `0 12px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${glow}`,
          yoyo: true,
          repeat: -1,
          duration: 1,
          ease: "sine.inOut",
        },
      );
    },
    { dependencies: [activeItem], scope: previewRef },
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const fullId = active.id as string;
    const separatorIndex = fullId.indexOf("::");

    if (separatorIndex === -1) {
      logger.error("Invalid drag ID format", { fullId });
      return;
    }

    const type = fullId.substring(0, separatorIndex);
    const id = fullId.substring(separatorIndex + 2);

    setActiveItem({
      id,
      type: type as "song" | "playlist" | "folder",
      data: active.data.current,
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveItem(null);

      if (!over || active.id === over.id) return;

      const parseId = (fullId: string) => {
        const separatorIndex = fullId.indexOf("::");
        if (separatorIndex === -1) {
          logger.error("Invalid ID format", { fullId });
          return { type: "", id: "" };
        }
        return {
          type: fullId.substring(0, separatorIndex),
          id: fullId.substring(separatorIndex + 2),
        };
      };

      const activeInfo = parseId(active.id as string);
      const overInfo = parseId(over.id as string);

      const dragItem: DragItem = {
        id: activeInfo.id,
        type: activeInfo.type as "song" | "playlist" | "folder",
        data: active.data.current,
      };

      const dropZone: DropZone = {
        id: overInfo.id,
        type: overInfo.type as "playlist" | "folder" | "root" | "song",
        data: over.data.current,
      };

      onDragOperation?.(dragItem, dropZone);
    },
    [onDragOperation],
  );

  const renderDragOverlay = () => {
    if (!activeItem) return null;

    switch (activeItem.type) {
      case "song":
        const isHoveringPlaylist = document
          .querySelector('[data-droppable="true"]')
          ?.closest('[data-playlist-drop-zone="true"]');

        if (isHoveringPlaylist) {
          return (
            <div ref={previewRef} className={dragStyles.songPreview}>
              <Icon
                name="music"
                size={18}
                color="var(--themecolor2)"
                decorative
              />
              <div>
                <div className={dragStyles.songTitle}>
                  {activeItem.data?.title || "Song"}
                </div>
                <div className={dragStyles.songArtist}>
                  {activeItem.data?.artist || t("common.unknownArtist")}
                </div>
              </div>
            </div>
          );
        } else {
          return null;
        }
      case "playlist":
        return null;
      case "folder":
        return null;
      default:
        return null;
    }
  };
  return (
    <DragContext.Provider value={{ activeItem }}>
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        autoScroll={{ threshold: { x: 0.2, y: 0.2 }, acceleration: 5 }}
      >
        {children}
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          className={dragStyles.dragOverlay}
        >
          {renderDragOverlay()}
        </DragOverlay>
      </DndContext>
    </DragContext.Provider>
  );
};

export const DraggableItem: React.FC<DraggableItemProps> = ({
  id,
  type,
  data,
  children,
  disabled = false,
  useDragHandle = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `${type}::${id}`,
      data: data,
      disabled,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const renderChildren = (): React.ReactNode => {
    if (useDragHandle && typeof children === "function") {
      return children({ listeners, attributes });
    } else if (
      useDragHandle &&
      typeof children !== "function" &&
      React.isValidElement(children)
    ) {
      return React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{
              __dragListeners?: DraggableSyntheticListeners;
            }>,
            {
              __dragListeners: listeners,
            },
          );
        }
        return child;
      });
    }
    return typeof children === "function" ? null : children;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={dragStyles.draggableItem}
      data-dragging={isDragging ? "true" : "false"}
      {...(useDragHandle ? {} : listeners)}
      {...(useDragHandle ? {} : attributes)}
    >
      {renderChildren()}
    </div>
  );
};

export const DragHandle: React.FC<{
  children: React.ReactNode;
  className?: string;
  listeners?: DragHandleProps["listeners"];
  attributes?: DragHandleProps["attributes"];
  __dragListeners?: DraggableSyntheticListeners;
}> = ({ children, className, listeners, attributes, __dragListeners }) => {
  const dragListeners = listeners || __dragListeners;
  return (
    <div
      className={`${dragStyles.dragHandle} ${className || ""}`}
      {...dragListeners}
      {...attributes}
    >
      {children}
    </div>
  );
};

export const DropZone: React.FC<DropZoneProps> = ({
  id,
  type,
  data,
  children,
  className,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `${type}::${id}`,
    data: data,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${dragStyles.dropZone} ${className || ""}`}
      data-droppable={isOver ? "true" : "false"}
      data-playlist-drop-zone={type === "playlist" ? "true" : "false"}
      data-folder-drop-zone={type === "folder" ? "true" : "false"}
      data-drop-type={type}
    >
      {children}
    </div>
  );
};

export const DraggableDropZone: React.FC<{
  dragId: string;
  dragType: "song" | "playlist" | "folder";
  dragData: { title: string; artist?: string };

  dropId: string;
  dropType: "playlist" | "folder" | "root" | "song";
  dropData: { title: string; artist?: string };
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}> = ({
  dragId,
  dragType,
  dragData,
  dropId,
  dropType,
  dropData,
  children,
  className,
  disabled = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `${dragType}::${dragId}`,
    data: dragData,
    disabled,
  });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `${dropType}::${dropId}`,
    data: dropData,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={{
        ...style,
        ...(isOver && {
          backgroundColor: "var(--primary-transparent-2)",
          borderRadius: "6px",
        }),
      }}
      className={className}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
};

export const useDragContext = () => {
  return React.useContext(DragContext);
};
