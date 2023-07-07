import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Box, Spacer, Static, Text } from "ink";

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

let _errors: string[] = [];

export function setError(...errors: string[]) {
  const uniqueErrors = [...new Set(errors)].filter(Boolean);
  _errors = uniqueErrors;
  notify();
}

export function clearErrors() {
  _errors = [];
  notify();
}

export const useErrors = () => {
  return useSyncExternalStore(subscribe, () => _errors);
};

export function CompilationErrors() {
  const errors = useErrors();

  if (errors.length === 0) {
    return;
  }

  return (
    <Box borderColor="red" borderStyle="round" paddingLeft={1} paddingRight={1} flexDirection="column" gap={1}>
      {errors.map((error) => (
        <Box key={error}>
          <Text color="gray">{">"}</Text>
          <Text>{' '}</Text>
          <Text key={error} color="red">{error}</Text>
        </Box>
      ))}
    </Box>
  );
}

