import {toSvg} from 'jdenticon';

export function Identicon({address}: {address: string}) {
  const svg = toSvg(address, 40, {
    padding: 0.8, // Reduce padding to make figures smaller relative to the canvas
    lightness: {
      color: [0, 10, 10, 0.4],   // Darker color (R, G, B, Alpha - adjust as needed)
    },
    backColor: 'black',
  }); // 40px size
  return (
    <div
      dangerouslySetInnerHTML={{__html: svg}}
      className="w-10 h-10"
    />
  );
}

