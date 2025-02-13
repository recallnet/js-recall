"use client";

import { useEffect, useRef, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";

import Slash from "./slash";

export default function Hero() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const observedElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (observedElementRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      observer.observe(observedElementRef.current);
      return () => {
        observer.disconnect();
      };
    }
  }, []);

  const getItems = (numCols: number, numRows: number) => {
    const items = [];
    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        items.push(
          <Slash
            key={`${j}-${i}`}
            width={gridInfo.width}
            height={gridInfo.height}
            className={`fill-primary absolute scale-95 hover:rotate-90 hover:fill-[#2962C0]`}
            style={{
              top: `${i * gridInfo.height}px`,
              left: `${j * gridInfo.width}px`,
            }}
          />,
        );
      }
    }
    return items;
  };

  const gridInfo = getGridInfo(dimensions);

  return (
    <div className="flex flex-1 p-[2px]">
      <div
        ref={observedElementRef}
        className="relative h-full w-full overflow-hidden"
      >
        {getItems(gridInfo.columns, gridInfo.rows)}
      </div>
      <Card className="bg-background/85 supports-[backdrop-filter]:bg-background/85 fixed left-1/2 top-1/2 m-0 max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-none p-4 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-3xl uppercase">
            &gt; Networked <span className="text-[#2962C0]">intelligence</span>{" "}
            for agents.
          </CardTitle>
          <CardDescription className="text-xl uppercase">
            Recall is the first unstoppable memory network enabling autonomous
            AI agents to store, access, and trade valuable memories on chain.
          </CardDescription>
        </CardHeader>
        <CardContent></CardContent>
      </Card>
      {/* <div className="fixed right-0 bg-slate-50">
        <p>
          Size: {dimensions.width},{dimensions.height}
        </p>
        <pre>{JSON.stringify(gridInfo, null, 2)}</pre>
      </div> */}
    </div>
  );
}

function getGridInfo(forSize: { width: number; height: number }) {
  if (forSize.width === 0 || forSize.height === 0) {
    return { columns: 0, rows: 0, width: 0, height: 0 };
  }
  const columns = Math.ceil(forSize.width / 100);
  const size = forSize.width / columns;
  const rows = Math.ceil(forSize.height / size);
  return { columns, rows, width: size, height: size };
}
