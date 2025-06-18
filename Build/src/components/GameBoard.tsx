"use client";

import React, { useRef, useEffect } from "react";
import * as PIXI from "pixi.js";
import styles from "./GameBoard.module.css";
import { GridData } from "../helpers/useGridData";

interface GameBoardProps {
  gridSize: { rows: number; columns: number };
  blockSize: number;
  gridData: GridData;
  className?: string;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gridSize,
  blockSize,
  gridData,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  // Create and manage the PIXI application
  useEffect(() => {
    if (!containerRef.current) return;

    // Calculate the total width and height of the grid
    const totalWidth = gridSize.columns * blockSize;
    const totalHeight = gridSize.rows * blockSize;

    // Create a new PIXI application if it doesn't exist
    if (!appRef.current) {
      appRef.current = new PIXI.Application({
        width: totalWidth,
        height: totalHeight,
        backgroundColor: 0x1a1a2e,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
      });

      // Add the PIXI canvas to the container
      containerRef.current.appendChild(appRef.current.view as HTMLCanvasElement);
    } else {
      // Update the size if the app already exists
      appRef.current.renderer.resize(totalWidth, totalHeight);
    }

    // Clear the stage
    appRef.current.stage.removeChildren();

    // Draw the grid
    const { colors } = gridData;
    for (let row = 0; row < gridSize.rows; row++) {
      for (let col = 0; col < gridSize.columns; col++) {
        const color = colors[row][col];
        const block = new PIXI.Graphics();
        
        // Convert hex color to number
        const colorNum = parseInt(color.replace("#", ""), 16);
        
        block.beginFill(colorNum);
        block.drawRect(0, 0, blockSize, blockSize);
        block.endFill();
        
        // Add a subtle border
        block.lineStyle(1, 0x000000, 0.1);
        block.drawRect(0, 0, blockSize, blockSize);
        
        // Position the block
        block.x = col * blockSize;
        block.y = row * blockSize;
        
        // Add the block to the stage
        appRef.current.stage.addChild(block);
      }
    }

    // Cleanup function
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true,
        });
        appRef.current = null;
      }
    };
  }, [gridSize, blockSize, gridData]);

  return (
    <div 
      ref={containerRef} 
      className={`${styles.gameBoard} ${className}`}
    />
  );
};