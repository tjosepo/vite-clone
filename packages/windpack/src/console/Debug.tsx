import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Box, Static, Text } from "ink";

let observers: (() => void)[] = [];

const subscribe = (o: () => void) => {
  observers.push(o);
  return () => {
    observers = observers.filter((observer) => observer !== o);
  };
};

const notify = () => {
  observers.forEach((o) => o());
};

interface Log {
  timestamp: string;
  data: any[];
}

let logs: Log[] = [];

export function debug(...data: any[]) {
  logs.push({ timestamp: performance.now().toFixed(0), data });
  logs = [...logs];
  notify();
}

export const useDebug = () => {
  return useSyncExternalStore(subscribe, () => logs);
};

export function Debug() {
  const logs = useDebug();

  if (logs.length === 0) {
    return;
  }

  return (
    <Static items={logs}>
      {(log, index) => (
        <Text key={index}>
          <Text color="gray">{log.timestamp} ms</Text> <Text color="blue">{log.data.join(" ")}</Text>
        </Text>
      )}
    </Static>
  );
}

