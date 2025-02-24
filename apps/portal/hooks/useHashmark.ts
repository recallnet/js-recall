import { useEffect, useState } from "react";

export function useHashmark() {
  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(window.location.hash);
    const onHashChange = () => {
      setHash(window.location.hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
}
