import { useState } from "react";

import { Form } from "../Form";

export type WaitlistState = "form" | "success";

export interface WaitlistProps {
  state: WaitlistState;
  setState: (state: WaitlistState) => void;
}

const renderState = (
  state: WaitlistState,
  setState: (state: WaitlistState) => void,
) => {
  const states = {
    form: <Form setState={setState} />,
    success: (
      <div className="flex flex-col gap-[15px] p-[10px]">
        <h2 className="text-foreground text-[25px] leading-[27px] lg:text-[38px] lg:leading-[44px]">
          Your inbox just got smarter.
        </h2>
        <div className="text-foreground flex flex-row items-center"></div>
      </div>
    ),
  };

  return states[state];
};

export const Waitlist = () => {
  const [state, setState] = useState<WaitlistState>("form");

  const bgClassName = {
    waitlist: "bg-foreground clip-path-container",
    form: "bg-foregroundLight clip-path-container clip-path-container-active",
    success:
      "bg-foregroundLight clip-path-container clip-path-container-active",
  };

  return (
    <div
      className={`relative h-[120px] shrink-0 lg:h-[138px] ${bgClassName[state]}`}
    >
      {renderState(state, setState)}
    </div>
  );
};
