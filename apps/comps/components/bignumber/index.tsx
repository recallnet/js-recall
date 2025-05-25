import React from "react";

interface BigNumberDisplayProps {
  value: string | bigint;
  decimals: number;
  displayDecimals?: number;
  compact?: boolean;
}

export const BigNumberDisplay: React.FC<BigNumberDisplayProps> = ({
  value,
  decimals,
  displayDecimals = 1,
  compact = true,
}) => {
  try {
    const bigIntValue = typeof value === "bigint" ? value : BigInt(value);
    const scale = 10n ** BigInt(decimals);
    const integerPart = bigIntValue / scale;
    const remainder = bigIntValue % scale;

    // Create a decimal by manually building it
    const remainderStr = remainder
      .toString()
      .padStart(decimals, "0")
      .slice(0, displayDecimals);
    const floatStr = `${integerPart.toString()}.${remainderStr}`;
    const numberValue = parseFloat(floatStr);

    const formatterOptions: Intl.NumberFormatOptions = {};

    if (compact) {
      formatterOptions.notation = "compact";
      formatterOptions.compactDisplay = "short";
    }

    if (displayDecimals !== undefined) {
      formatterOptions.maximumFractionDigits = displayDecimals;
    }

    const formatter = new Intl.NumberFormat("en", formatterOptions);
    const formattedValue = formatter.format(numberValue);

    return <span>{formattedValue}</span>;
  } catch (error) {
    console.error("Error formatting BigInt:", error);
    return <span>Error</span>;
  }
};

export default BigNumberDisplay;
