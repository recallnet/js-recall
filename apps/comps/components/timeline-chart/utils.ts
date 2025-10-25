import { DateArr } from "./types";

/**
 * Utility functions for TimelineChart
 */

/**
 * Format date to "Month dayth" style (e.g., "Jun 1st", "May 23rd")
 */
export const formatDateShort = (
  dateStr: string | Date,
  includeTime?: boolean,
): string => {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";

  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();

  // Add ordinal suffix (st, nd, rd, th)
  const getOrdinalSuffix = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  let result = `${month} ${day}${getOrdinalSuffix(day)}`;

  if (includeTime) {
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
    result += ` ${time}`;
  }

  return result;
};

const copyDateWithoutTimezone = (timestamp: string) => {
  const [year, month, day] = timestamp.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(year, month - 1, day);
};

const fillMissingDays = (week: DateArr) => {
  const res = [];

  let prev = 0;
  for (const cur of week) {
    const cpy = copyDateWithoutTimezone(cur.timestamp);
    const day = new Date(cpy);

    cpy.setDate(cpy.getDate() - (cpy.getDay() - prev));
    while (day.getDay() > cpy.getDay()) {
      res.push({ timestamp: new Date(cpy) });
      cpy.setDate(cpy.getDate() + 1);
    }

    res.push(cur);
    prev = day.getDay() + 1;
  }

  const cur = copyDateWithoutTimezone(res[res.length - 1]?.timestamp as string);
  while (cur.getDay() < 6) {
    cur.setDate(cur.getDate() + 1);
    res.push({ timestamp: new Date(cur) });
  }

  return res;
};

export const datesByWeek = (dates: DateArr) => {
  if (dates.length === 0) return [];

  const weekMap = new Map<string, DateArr>();

  dates.forEach((timestamp) => {
    const currentDate = new Date(timestamp.timestamp);

    // Get the start of the week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Use the start of week as the key
    const weekKey = startOfWeek.toISOString();

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }

    weekMap.get(weekKey)!.push(timestamp);
  });

  const final = Array.from(weekMap.entries()).map(([, weekDates]) =>
    fillMissingDays(weekDates),
  );

  return final;
};
