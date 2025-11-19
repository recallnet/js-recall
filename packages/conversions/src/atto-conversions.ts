import * as dnum from "dnum";

const attoDivisor = dnum.from("1000000000000000000");

export function attoValueToNumberValue(
  attoValue: dnum.Numberish,
  rounding: dnum.Rounding = "ROUND_DOWN", // Default round down to avoid overestimating balance
  decimals: number = 18,
) {
  const res = dnum.div(attoValue, attoDivisor, {
    rounding,
    decimals,
  });
  return dnum.toNumber(res);
}

export const attoValueToStringValue = (
  attoValue: dnum.Numberish,
  rounding: dnum.Rounding = "ROUND_DOWN", // Default round down to avoid overestimating balance
  decimals: number = 18,
) => {
  const res = dnum.div(attoValue, attoDivisor, {
    rounding,
    decimals,
  });
  return dnum.toString(res);
};

export function valueToAttoString(value: dnum.Numberish) {
  const res = dnum.mul(dnum.from(value), attoDivisor);
  return dnum.toString(res);
}

export function valueToAttoBigInt(value: dnum.Numberish) {
  const res = dnum.mul(value, attoDivisor);
  return BigInt(dnum.toString(res));
}
