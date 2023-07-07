import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Box, render, Spacer, Static, Text, TextProps } from "ink";
import { CompilationErrors, useErrors } from "./Errors.js";
import { Debug } from "./Debug.js";

let observers: (() => void)[] = [];

const subscribe = (o: () => void) => {
  observers.push(o);
  return () => {
    observers = observers.filter((observer) => observer !== o);
  };
};

type State = {
  state: "setup"| "compiling" | "building" | "done" | "clear";
  module: string | undefined;
  time: number;
  url: string;
};

let state: State = {
  state: "setup",
  module: undefined,
  url: "",
  time: 0,
};

export function setState(fn: (state: State) => State) {
  state = fn(state);
  observers.forEach((o) => o());
}

const Spinner = (props: TextProps) => {
  const [count, setCount] = useState(0);
  const spinner = ["⠾", "⠷", "⠯", "⠟", "⠻", "⠽"];

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((previousCounter) => (previousCounter + 1) % spinner.length);
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return <Text color="cyan" {...props}>{spinner[count]}</Text>;
};

const Compilation = () => {
  const errors = useErrors();
  const currentState = useSyncExternalStore(subscribe, () => state.state);
  const time = useSyncExternalStore(subscribe, () => state.time);
  const url = useSyncExternalStore(subscribe, () => state.url);

  if (currentState === "clear") {
    return null;
  }

  if (currentState === "setup") {
    return (
      <Text>
        <Spinner /> <Text >Starting...</Text>
      </Text>
    );
  }

  if (currentState === "compiling") {
    return (
      <Text>
        <Spinner /> <Text >Compiling...</Text>
      </Text>
    );
  }

  
  if (currentState === "building") {
    return (
      <Text>
        <Spinner /> <Text >Building for production...</Text>
      </Text>
    );
  }

  if (errors.length > 0) {
    return (
      <Text>
        <Text color="yellow">⚠</Text> Compiled with errors
      </Text>
    );
  }

  const displayTime =
    Number(time) < 1000
      ? `${time} ms`
      : `${(Number(time) / 1000).toFixed(2)} s`;

  return (
    <>
      <Text>
        <Text color="green">✓</Text> Compilation done in {displayTime}
      </Text>
      <Box marginTop={1} display="flex" gap={2}>
          <Text color="green">➜</Text>
          <Text bold>Local:</Text>
          <Text color="cyan">{url}</Text>
      </Box>
    </>
  );
};

const Console = () => (
  <>
    <Static items={["title"]}>
      {(key) => (
        <Text key={key} color="magenta" bold>
          Windpack
        </Text>
      )}
    </Static>
    <Compilation />
    <CompilationErrors />
    {/* <Debug /> */}
  </>
);

export default () => {
  const debug = false;
  console.clear();

  return render(
    <DebugProvider debug={debug}>
      <Console />
    </DebugProvider>,
    {
      debug,
    }
  );
};

const DebugContext = createContext(false);

const useDebug = () => useContext(DebugContext);

export const DebugProvider = ({
  debug,
  children,
}: {
  debug: boolean;
  children: React.ReactNode;
}) => <DebugContext.Provider value={debug}>{children}</DebugContext.Provider>;
