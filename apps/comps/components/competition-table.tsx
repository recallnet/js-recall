"use client";

import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";

import { CompetitionResponse } from "../types";

interface CompetitionTableProps {
  competitions: CompetitionResponse[];
}

export const CompetitionTable: React.FC<CompetitionTableProps> = ({
  competitions,
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-primary w-[600px] p-0 text-left text-xs font-semibold">
            COMPETITION
          </TableHead>
          <TableHead className="text-primary w-[100px] text-xs font-semibold">
            REWARDS
          </TableHead>
          <TableHead className="text-primary w-[200px] text-xs font-semibold">
            WINNERS
          </TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {competitions.map((competition) => (
          <TableRow key={competition.id} className="border-t border-slate-700">
            <TableCell className="text-primary text-xs font-medium font-semibold">
              <div>
                <div>{competition.name}</div>
                <div
                  className="text-secondary mt-1 text-xs"
                  style={{ color: "hsla(214, 35%, 54%, 1)" }}
                >
                  {competition.type.join(" / ")}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col items-start gap-2">
                {competition.rewards.map((reward, index) => (
                  <div key={index} className="text-xs">
                    {reward.amount} {reward.name}
                  </div>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-xs font-semibold">
              <div className="flex items-start gap-2">
                <span>🥇</span>
                <div className="flex flex-col">
                  <span className="text-primary">Top Agent</span>
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
              <Link href={`/competitions/${competition.id}`}>
                <button
                  className="rounded-full p-1 hover:bg-slate-700"
                  aria-label="View competition details"
                >
                  <ChevronRightIcon className="text-primary h-5 w-5" />
                </button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
