import { useMemo } from "react";
import { useGraph } from "dsssp";

const MINOR_TICK_MULTIPLES = [2, 4] as const;

export interface EqualizerGraphGridProps {
  minFreq: number;
  maxFreq: number;
}

export function EqualizerGraphGrid({
  minFreq,
  maxFreq,
}: EqualizerGraphGridProps) {
  const { height, logScale, theme } = useGraph();
  const { grid, label } = theme.background;

  const ticks = useMemo(() => {
    const majors: number[] = [];
    const minors: number[] = [];

    for (let base = 10; base <= maxFreq; base *= 10) {
      if (base > minFreq && base < maxFreq) {
        majors.push(base);
      }
      for (const multiple of MINOR_TICK_MULTIPLES) {
        const frequency = base * multiple;
        if (frequency > minFreq && frequency < maxFreq) {
          minors.push(frequency);
        }
      }
    }

    return { majors, minors };
  }, [minFreq, maxFreq]);

  return (
    <g aria-hidden="true">
      {ticks.minors.map((frequency) => {
        const x = logScale.x(frequency);
        return (
          <line
            key={frequency}
            x1={x}
            x2={x}
            y1="0"
            y2="100%"
            stroke={grid.lineColor}
            strokeWidth={grid.lineWidth.minor}
          />
        );
      })}
      {ticks.majors.map((frequency) => (
        <g key={frequency}>
          <line
            x1={logScale.x(frequency)}
            x2={logScale.x(frequency)}
            y1="0"
            y2="100%"
            stroke={grid.lineColor}
            strokeWidth={grid.lineWidth.major}
          />
          <text
            x={logScale.x(frequency) + 4}
            y={height - 4}
            fill={label.color}
            fontSize={label.fontSize}
            fontFamily={label.fontFamily}
            textAnchor="start"
          >
            {formatTickLabel(frequency)}
          </text>
        </g>
      ))}
    </g>
  );
}

function formatTickLabel(frequency: number): string {
  if (frequency >= 1000) {
    const kHz = frequency / 1000;
    return `${Number.isInteger(kHz) ? kHz : kHz.toFixed(2)}k`;
  }
  return String(Math.round(frequency));
}
