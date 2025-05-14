import React from 'react';
import BigNumber from 'bignumber.js';

interface BigNumberDisplayProps {
  value: string | BigNumber;
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
    const bigNum = new BigNumber(value);
    const actualValue = bigNum.dividedBy(new BigNumber(10).pow(decimals));
    const numberValue = actualValue.toNumber();

    const formatterOptions: Intl.NumberFormatOptions = {};

    if (compact) {
      formatterOptions.notation = 'compact';
      formatterOptions.compactDisplay = 'short';
    }

    if (displayDecimals !== undefined) {
      formatterOptions.maximumFractionDigits = displayDecimals;
    }

    const formatter = new Intl.NumberFormat('en', formatterOptions);
    const formattedValue = formatter.format(numberValue);

    return <span>{formattedValue}</span>;
  } catch (error) {
    console.error('Error formatting BigNumber:', error);
    return <span>Error</span>;
  }
};

export default BigNumberDisplay;
