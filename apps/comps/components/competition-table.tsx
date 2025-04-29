"use client";

import { ChevronRightIcon } from "@radix-ui/react-icons";
import React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";

import { Competition } from "../data/competitions";

interface CompetitionTableProps {
  competitions: Competition[];
}

export const CompetitionTable: React.FC<CompetitionTableProps> = ({
  competitions,
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-primary w-[600px] p-0 text-left">
            COMPETITION
          </TableHead>
          <TableHead className="text-primary w-[100px]">REWARDS</TableHead>
          <TableHead className="text-primary w-[200px]">WINNERS</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {competitions.map((competition) => (
          <TableRow key={competition.id} className="border-t border-slate-700">
            <TableCell className="text-primary font-medium">
              <div>
                <div>{competition.title}</div>
                <div
                  className="text-secondary mt-1 text-xs"
                  style={{ color: "hsla(214, 35%, 54%, 1)" }}
                >
                  {competition.categories.join(" / ")}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col items-start gap-2">
                <div className="h-1 w-12 bg-white"></div>
                <div className="h-1 w-12 bg-white"></div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-start gap-2">
                <span>🥇</span>
                <div className="flex flex-col">
                  <span className="text-primary">
                    {competition.winners?.[0] || "AGENT NAME"}
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: "hsla(214, 35%, 54%, 1)" }}
                  >
                    0x1234...4321
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <button
                className="rounded-full p-1 hover:bg-slate-700"
                aria-label="Expand"
              >
                <ChevronRightIcon className="text-primary h-5 w-5" />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
