import React from "react";

interface HeadingProps {
  text1: string;
  text2: string;
  className?: string;
}

export const Heading: React.FunctionComponent<HeadingProps> = ({
  text1,
  text2,
  className = "",
}) => {
  return (
    <h2 className={`text-2xl ${className}`}>
      <span className="text-gray-6">{text1}</span>
      <span className="text-gray-5"> {text2}</span>
    </h2>
  );
};
