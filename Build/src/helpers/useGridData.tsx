"use client";

import { useMemo, useState } from "react";

interface GridSize {
  rows: number;
  columns: number;
}

export interface GridData {
  colors: string[][];
}

export function useGridData(initialSize: GridSize) {
  const [gridSize, setGridSize] = useState<GridSize>(initialSize);

  // Generate a random color in hex format
  const getRandomColor = () => {
    const colors = [
      "#FF5252", // Red
      "#FF4081", // Pink
      "#E040FB", // Purple
      "#7C4DFF", // Deep Purple
      "#536DFE", // Indigo
      "#448AFF", // Blue
      "#40C4FF", // Light Blue
      "#18FFFF", // Cyan
      "#64FFDA", // Teal
      "#69F0AE", // Green
      "#B2FF59", // Light Green
      "#EEFF41", // Lime
      "#FFFF00", // Yellow
      "#FFD740", // Amber
      "#FFAB40", // Orange
      "#FF6E40", // Deep Orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Initialize grid with random colors
  const initializeGrid = (size: GridSize): GridData => {
    const colors: string[][] = [];
    for (let i = 0; i < size.rows; i++) {
      const row: string[] = [];
      for (let j = 0; j < size.columns; j++) {
        row.push(getRandomColor());
      }
      colors.push(row);
    }
    return { colors };
  };

  // Memoize the grid data to avoid recalculation on every render
  const gridData = useMemo(() => initializeGrid(gridSize), [gridSize]);

  // Get color at specific position
  const getColorAt = (row: number, column: number): string => {
    if (
      row >= 0 &&
      row < gridData.colors.length &&
      column >= 0 &&
      column < gridData.colors[0].length
    ) {
      return gridData.colors[row][column];
    }
    return "#000000"; // Default color if out of bounds
  };

  // Regenerate the grid with new random colors
  const regenerateGrid = () => {
    setGridSize({ ...gridSize }); // Trigger re-initialization by updating state
  };

  // Update grid size and regenerate
  const updateGridSize = (newSize: GridSize) => {
    setGridSize(newSize);
  };

  return {
    gridData,
    gridSize,
    getColorAt,
    regenerateGrid,
    updateGridSize,
  };
}
