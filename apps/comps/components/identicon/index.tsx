import { toSvg } from "jdenticon";

export function Identicon({ address }: { address: string }) {
  const svg = toSvg(address, 40, {
    padding: 0.8,
    hues: [227],
    lightness: {
      color: [0.74, 1.0],
      grayscale: [0.63, 0.82],
    },
    saturation: {
      color: 0.51,
      grayscale: 0.67,
    },
    backColor: "#0000",
  });
  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      className="h-10 w-10 rounded-full bg-gray-700"
    />
  );
}
