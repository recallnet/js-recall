import { useState } from "react";

interface UseSubscribeProps {
  listType: "general" | "comps";
  onSuccess: () => void;
}

interface UseSubscribeReturn {
  email: string;
  status: "idle" | "loading" | "error" | "success";
  message: string;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  setEmail: (email: string) => void;
}

export function useSubscribe({
  listType,
  onSuccess,
}: UseSubscribeProps): UseSubscribeReturn {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [message, setMessage] = useState("");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setStatus("loading");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, listType }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        setEmail("");
        onSuccess();
      } else {
        throw new Error(data.message || "Something went wrong");
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to subscribe",
      );
    }
  };

  return {
    email,
    status,
    message,
    handleSubmit,
    setEmail,
  };
}
