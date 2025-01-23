import * as dn from "dnum";

export function formatAttoRcl(
  attoRcl: dn.Numberish,
  options?: {
    decimals?: number;
    precision?: number;
  },
) {
  const val = dn.from(attoRcl, options?.decimals ?? 18);
  return dn.format(val, options?.precision ?? 2);
}
