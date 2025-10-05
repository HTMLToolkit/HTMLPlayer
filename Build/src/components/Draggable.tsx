import React, { useState, useCallback } from 'react';
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
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Icon } from './Icon';
import dragStyles from './DragOverlay.module.css';
import { useTranslation } from 'react-i18next';

// Types for our drag operations
export interface DragItem {
  id: string;
  type: 'song' | 'playlist' | 'folder';
  data: any; // The actual song/playlist/folder data
};

export interface DropZone {
  id: string;
  type: 'playlist' | 'folder' | 'root' | 'song';
  data: any; // The target playlist/folder/song data
};

export type DragOperationHandler = (dragItem: DragItem, dropZone: DropZone) => void;

interface DraggableProviderProps {
  children: React.ReactNode;
  onDragOperation?: DragOperationHandler;
}

interface DraggableItemProps {
  id: string;
  type: 'song' | 'playlist' | 'folder';
  data: any;
  children: React.ReactNode;
  disabled?: boolean;
}

interface DropZoneProps {
  id: string;
  type: 'playlist' | 'folder' | 'root' | 'song';
  data: any;
  children: React.ReactNode;
  className?: string;
}

// Context for sharing drag state
const DragContext = React.createContext<{
  activeItem: DragItem | null;
}>({
  activeItem: null,
});



// Main provider component
// Custom collision detection that prioritizes based on spatial context
const customCollisionDetection: CollisionDetection = (args) => {
  // Try multiple collision detection strategies
  // pointerWithin is more lenient than rectIntersection
  let intersections = pointerWithin(args);
  
  // Fall back to closestCenter if no pointer intersections
  if (!intersections || intersections.length === 0) {
    intersections = closestCenter(args);
  }
  
  if (!intersections || !intersections.length) return intersections || [];
  
  // If we have multiple intersections, use spatial logic to determine intent
  const songIntersections = intersections.filter(intersection => 
    intersection.id.toString().startsWith('song::')
  );
  
  const playlistIntersections = intersections.filter(intersection => 
    intersection.id.toString().startsWith('playlist::')
  );
  
  // If we have both song and playlist intersections, check spatial position
  if (songIntersections.length > 0 && playlistIntersections.length > 0) {
    // Get the pointer position from the drag event
    const { pointerCoordinates } = args;
    
    if (pointerCoordinates) {
      // If dragging to the left side of screen (where playlists typically are), prefer playlists
      // Adjust this threshold based on your layout - assuming sidebar is ~300px wide
      if (pointerCoordinates.x < 350) {
        return playlistIntersections;
      }
      
      // Otherwise, prefer song reordering (main content area)
      return songIntersections;
    }
  }
  
  return intersections;
};

export const DraggableProvider: React.FC<DraggableProviderProps> = ({
  children,
  onDragOperation,
}) => {
  const { t } = useTranslation();
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Enough distance to prevent accidental drags on clicks
        delay: 100,   // Small delay to distinguish clicks from drags
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const fullId = active.id as string;
    const separatorIndex = fullId.indexOf('::');
    
    if (separatorIndex === -1) {
      console.error('Invalid drag ID format:', fullId);
      return;
    }
    
    const type = fullId.substring(0, separatorIndex);
    const id = fullId.substring(separatorIndex + 2);
    
    setActiveItem({
      id,
      type: type as 'song' | 'playlist' | 'folder',
      data: active.data.current,
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over || active.id === over.id) return;

    const parseId = (fullId: string) => {
      const separatorIndex = fullId.indexOf('::');
      if (separatorIndex === -1) {
        console.error('Invalid ID format:', fullId);
        return { type: '', id: '' };
      }
      return {
        type: fullId.substring(0, separatorIndex),
        id: fullId.substring(separatorIndex + 2)
      };
    };

    const activeInfo = parseId(active.id as string);
    const overInfo = parseId(over.id as string);

    const dragItem: DragItem = {
      id: activeInfo.id,
      type: activeInfo.type as 'song' | 'playlist' | 'folder',
      data: active.data.current,
    };

    const dropZone: DropZone = {
      id: overInfo.id,
      type: overInfo.type as 'playlist' | 'folder' | 'root' | 'song',
      data: over.data.current,
    };

    onDragOperation?.(dragItem, dropZone);
  }, [onDragOperation]);

  const renderDragOverlay = () => {
    if (!activeItem) return null;

    switch (activeItem.type) {
      case 'song':
        const isHoveringPlaylist = document.querySelector('[data-droppable="true"]')?.closest('[data-playlist-drop-zone="true"]');
        
        if (isHoveringPlaylist) {
          // Enhanced preview for dragging TO playlists
          return (
            <div className={dragStyles.songPreview}>
              <Icon name="music" size={18} color="var(--themecolor2)" decorative />
              <div>
                <div className={dragStyles.songTitle}>
                  {activeItem.data?.title || 'Song'}
                </div>
                <div className={dragStyles.songArtist}>
                  {activeItem.data?.artist || t("common.unknownArtist")}
                </div>
              </div>
            </div>
          );
        } else {
          // No preview for reordering within playlists - song titles are already visible
          return null;
        }
      case 'playlist':
        // No preview for playlists - they're in the sidebar and visible
        return null;
      case 'folder':
        // No preview for folders - they're in the sidebar and visible
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
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          className={dragStyles.dragOverlay}
        >
          {renderDragOverlay()}
        </DragOverlay>
      </DndContext>
    </DragContext.Provider>
  );
};

// Draggable item component
export const DraggableItem: React.FC<DraggableItemProps> = ({
  id,
  type,
  data,
  children,
  disabled = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `${type}::${id}`,
    data: data,
    disabled,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={dragStyles.draggableItem}
      data-dragging={isDragging ? "true" : "false"}
      {...listeners} 
      {...attributes}
    >
      {children}
    </div>
  );
};

// Drop zone component
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
      className={`${dragStyles.dropZone} ${className || ''}`}
      data-droppable={isOver ? "true" : "false"}
      data-playlist-drop-zone={type === "playlist" ? "true" : "false"}
      data-folder-drop-zone={type === "folder" ? "true" : "false"}
      data-drop-type={type}
    >
      {children}
    </div>
  );
};

// Combined draggable and droppable component
export const DraggableDropZone: React.FC<{
  dragId: string;
  dragType: 'song' | 'playlist' | 'folder';
  dragData: any;
  dropId: string;
  dropType: 'playlist' | 'folder' | 'root' | 'song';
  dropData: any;
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

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={{
        ...style,
        ...(isOver && {
          backgroundColor: 'var(--accent-transparent)',
          borderRadius: '6px',
        })
      }}
      className={className}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
};

// Hook to use drag context
export const useDragContext = () => {
  return React.useContext(DragContext);
};