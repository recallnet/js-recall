import React from "react";

interface BigNumberDisplayProps {
  value: string | bigint;
  decimals: number;
  displayDecimals?: number;
  compact?: boolean;
  className?: string;
}

export const BigNumberDisplay: React.FC<BigNumberDisplayProps> = ({
  value,
  decimals,
  displayDecimals = 1,
  compact = true,
  className
}) => {
  try {
    let numberToFormat: number;

    if (typeof value === "string" && value.includes(".")) {
      // Case 1: Value is a string already representing a decimal number (e.g., "4321.1234")
      // 'value' is assumed to be in base units.
      // 'displayDecimals' will control the output format.
      numberToFormat = parseFloat(value);
      if (isNaN(numberToFormat)) {
        console.error("Error parsing decimal string input:", value);
        return <span className={className}>Error</span>;
      }
    } else {
      // Case 2: Value is a bigint or a string representing a whole integer (smallest units)
      let tempBigIntValue: bigint;
      if (typeof value === "bigint") {
        tempBigIntValue = value;
      } else {
        // value is a string
        // Ensure the string is a valid integer representation before BigInt conversion
        if (!/^-?\d+$/.test(value)) {
          // Allows negative integers
          console.error("Invalid integer string for BigInt conversion:", value);
          return <span className={className}>Error</span>;
        }
        tempBigIntValue = BigInt(value);
      }

      const scale = 10n ** BigInt(decimals);
      const integerPart = tempBigIntValue / scale;
      const remainder = tempBigIntValue % scale;

      let numStr = integerPart.toString();
      if (displayDecimals > 0) {
        const positiveRemainder = remainder < 0n ? -remainder : remainder;
        const currentMaxLength = Number(decimals); // Explicitly define maxLength
        const currentFillString = "0"; // Explicitly define fillString
        const remainderStr = positiveRemainder
          .toString()
          .padStart(currentMaxLength, currentFillString)
          .slice(0, displayDecimals);
        numStr += `.${remainderStr}`;
      }

      numberToFormat = parseFloat(numStr);
      if (isNaN(numberToFormat)) {
        console.error("Error constructing number from BigInt parts:", numStr);
        return <span className={className}>Error</span>;
      }
    }

    const formatterOptions: Intl.NumberFormatOptions = {};
    if (compact) {
      formatterOptions.notation = "compact";
      formatterOptions.compactDisplay = "short";
    }

    if (displayDecimals >= 0) {
      // Allow displayDecimals = 0 for no fractional part
      formatterOptions.maximumFractionDigits = displayDecimals;
    }

    const formatter = new Intl.NumberFormat("en", formatterOptions);
    const formattedValue = formatter.format(numberToFormat);

    return <span className={className}>{formattedValue}</span>;
  } catch (error) {
    console.error("Error formatting BigInt:", error);
    return <span className={className}>Error</span>;
  }
};

export default BigNumberDisplay;
