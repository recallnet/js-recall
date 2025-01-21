import * as dn from "dnum";

export function formatAttoRcl(
  attoRcl: bigint,
  options?: {
    decimals?: number;
    precision?: number;
  },
) {
  const val = [attoRcl, options?.decimals ?? 18] as dn.Dnum;
  return dn.format(val, options?.precision ?? 2);
}
