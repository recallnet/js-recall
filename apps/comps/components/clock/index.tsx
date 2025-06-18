import React, { useEffect, useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { useInterval } from "@/hooks/useInterval";

interface CountdownClockProps {
  targetDate: Date;
  className?: string;
  showDuration?: boolean;
  onFinish?: () => void;
}

export const CountdownClock: React.FC<CountdownClockProps> = ({
  targetDate,
  className,
  showDuration,
  onFinish,
}) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  // set to null pauses interval
  const [delay, setDelay] = useState<number | null>(1000);
  const [duration, setDuration] = useState("");
  const [isCountdownFinished, setIsCountdownFinished] = useState(false);

  const pluralize = (amount: number, word: string) =>
    `${word}${amount > 1 ? "s" : ""}`;

  const addLeadingZeros = (num: number) => {
    return num.toString().padStart(2, "0");
  };

  const finished = () => {
    setDelay(null);
    onFinish?.();
  };

  const updateDisplay = () => {
    if (isCountdownFinished) {
      // This gives the view 1 second to display finished state before calling
      // the onFinish. If `onFinish` does nothing the interval remains paused.
      finished();
      return;
    }

    const now = new Date();
    const difference = targetDate.getTime() - now.getTime();
    if (difference <= 0) {
      // Countdown finished, reset time and duration, and show finished text.
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      setIsCountdownFinished(true);
      setDuration("");
      return;
    }

    // We need to test if there is more than 24 hours until start, so we round
    // down and make sure there is at least one full day.
    const hasDays = Math.floor(difference / (1000 * 60 * 60 * 24)) >= 1;
    if (hasDays && showDuration === true) {
      // For display, we want to round to nearest int as you would expect
      const days = Math.round(difference / (1000 * 60 * 60 * 24));
      if (days <= 7) {
        setDuration(`${days} ${pluralize(days, "day")}`);
      } else if (days < 30) {
        const weeks = Math.round(difference / (1000 * 60 * 60 * 24 * 7));
        setDuration(`${weeks} ${pluralize(weeks, "week")}`);
      } else {
        const months = Math.round(difference / (1000 * 60 * 60 * 24 * 7 * 30));
        setDuration(`${months} ${pluralize(months, "month")}`);
      }

      return;
    }
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    // reset duration
    setDuration("");
    setTimeLeft({ hours, minutes, seconds });
  };

  useEffect(() => {
    const now = new Date();
    const difference = targetDate.getTime() - now.getTime();

    // do initial display update so the banner doesn't show 00:00:00 for the first second
    updateDisplay();

    if (difference > 1000) {
      setDelay(1000);
      setIsCountdownFinished(false);
    }
  }, [targetDate]);

  useInterval(updateDisplay, delay);

  if (isCountdownFinished) {
    return (
      <p className={cn("text-2xl text-white", className)}>
        Countdown Finished!
      </p>
    );
  }

  if (duration) {
    return (
      <span className={cn("text-2xl text-white", className)}>{duration}</span>
    );
  }

  return (
    <span className={cn("text-2xl text-white", className)}>
      {addLeadingZeros(timeLeft.hours)}:{addLeadingZeros(timeLeft.minutes)}:
      {addLeadingZeros(timeLeft.seconds)}
    </span>
  );
};

export default CountdownClock;
