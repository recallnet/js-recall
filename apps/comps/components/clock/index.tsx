import React, { useEffect, useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface CountdownClockProps {
  targetDate: Date;
  className?: string;
}

export const CountdownClock: React.FC<CountdownClockProps> = ({
  targetDate,
  className,
}) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isCountdownFinished, setIsCountdownFinished] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor(
          (difference % (1000 * 60 * 60)) / (1000 * 60),
        );
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        setIsCountdownFinished(true);
      }
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [targetDate]);

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

  return (
    <span className={cn("font-mono text-2xl text-white", className)}>
      {addLeadingZeros(timeLeft.hours)}:{addLeadingZeros(timeLeft.minutes)}:
      {addLeadingZeros(timeLeft.seconds)}
    </span>
  );
};

export default CountdownClock;
