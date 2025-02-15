// TODO:Convert to bigint
export function formatBytes(bytes: number) {
  const sizes = (i: number, val: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (i === 0 && val === 1) return "Byte";
    return sizes[i];
  };
  if (bytes === 0) return { val: 0, unit: "Bytes" };
  const i = Number.parseInt(
    Math.floor(Math.log(bytes) / Math.log(1024)).toString(),
  );
  const val = Math.round((bytes / Math.pow(1024, i)) * 100) / 100;
  return {
    val,
    unit: sizes(i, val),
    formatted: `${val} ${sizes(i, val)}`,
  };
}
