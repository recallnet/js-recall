// TODO:Convert to bigint
export function formatBytes(bytes: bigint | number) {
  const sizes = (i: number, val: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (i === 0 && val === 1) return "Byte";
    return sizes[i];
  };

  const bytesNum = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (bytesNum === 0) return { val: 0, unit: "Bytes" };

  const i = Math.min(
    4, // Cap at TB
    Math.floor(Math.log(bytesNum) / Math.log(1024))
  );
  const val = Math.round((bytesNum / Math.pow(1024, i)) * 100) / 100;
  return {
    val,
    unit: sizes(i, val),
    formatted: `${val} ${sizes(i, val)}`,
  };
}
