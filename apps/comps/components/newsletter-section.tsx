"use client";

import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Input } from "@recallnet/ui2/components/input";

export const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This would be where you'd handle the actual submission
    console.log("Subscribing email:", email);
    setEmail("");
  };

  return (
    <section className="my-12">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-secondary">
            Sign up for alerts about new competitions on testnet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full md:w-auto">
          <div className="flex flex-grow">
            <Input
              type="email"
              placeholder="EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border bg-transparent"
              required
            />
            <Button
              type="submit"
              variant="default"
              className="whitespace-nowrap rounded-l-none border border-l-0 dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white"
            >
              NOTIFY ME
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
};
