import * as dnum from "dnum";

const attoDivisor = dnum.from("1000000000000000000");

export function attoValueToNumberValue(
  attoValue: dnum.Numberish,
  rounding: dnum.Rounding = "ROUND_DOWN", // Default round down to avoid overestimating balance
) {
  const res = dnum.div(attoValue, attoDivisor, {
    rounding: rounding,
    decimals: 18,
  });
  return dnum.toNumber(res);
}

export function valueToAttoString(value: dnum.Numberish) {
  const res = dnum.mul(dnum.from(value), attoDivisor);
  return dnum.toString(res);
}

export function valueToAttoBigInt(value: dnum.Numberish) {
  const res = dnum.mul(value, attoDivisor);
  return BigInt(dnum.toString(res));
}
