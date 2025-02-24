import { useEffect, useRef } from "react";

export function usePrevious<T>(value: T) {
  const prevValueRef = useRef(value);
  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  return { prev: prevValueRef.current, current: value };
}
