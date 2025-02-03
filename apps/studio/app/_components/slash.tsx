import { SVGProps } from "react";

export default function Slash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        id="Path"
        fillRule="evenodd"
        stroke="none"
        d="M 30.672127 0 L 99.992989 69.004974 L 99.992989 100 L 70.619209 100 L 0 29.7033 L 0 0 Z"
      />
    </svg>
  );
}
