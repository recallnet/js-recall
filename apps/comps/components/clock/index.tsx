import React, { useEffect, useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface CountdownClockProps {
  targetDate: Date;
  className?: string;
  showDuration?: boolean;
}

export const CountdownClock: React.FC<CountdownClockProps> = ({
  targetDate,
  className,
  showDuration,
}) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [duration, setDuration] = useState("");
  const [isCountdownFinished, setIsCountdownFinished] = useState(false);

  const pluralize = (amount: number, word: string) =>
    `${word}${amount > 1 ? "s" : ""}`;
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        // Countdown is finished, so we will reset time and duration, and
        // show finished text.
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        setIsCountdownFinished(true);
        setDuration("");
        return;
      }

      // We need to test if there is more than 24 hours until start, so we
      // round down and make sure there is at least one full day
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
          const months = Math.round(
            difference / (1000 * 60 * 60 * 24 * 7 * 30),
          );
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

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [showDuration, targetDate]);

  const addLeadingZeros = (num: number) => {
    return num.toString().padStart(2, "0");
  };

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
