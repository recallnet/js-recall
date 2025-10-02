import { twMerge } from "tailwind-merge";

export const EarnBg = ({ isActive }: { isActive: boolean }) => (
  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
    <div className="translate-y-[-300px] max-lg:scale-75">
      <svg
        width="960"
        height="575"
        viewBox="0 0 960 575"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clipPath="url(#clip0_29_4178)">
          <g clipPath="url(#clip1_29_4178)">
            <rect
              x="-85.0547"
              y="-106.605"
              width="812"
              height="6.01367"
              transform="rotate(45 -85.0547 -106.605)"
              fill="#0064C7"
              className={twMerge(
                "transition-all delay-[0.4s] duration-[1s]",
                isActive ? "w-full" : "w-0",
              )}
            />
            <rect
              x="-83.957"
              y="-97.1367"
              width="812"
              height="9.11971"
              transform="rotate(45 -83.957 -97.1367)"
              fill="#38A430"
              className={twMerge(
                "transition-all delay-[0.3s] duration-[1s]",
                isActive ? "w-full" : "w-0",
              )}
            />
            <rect
              x="-82.8125"
              y="-83.541"
              width="812"
              height="12.358"
              transform="rotate(45 -82.8125 -83.541)"
              fill="#F9B700"
              className={twMerge(
                "transition-all delay-[0.2s] duration-[1s]",
                isActive ? "w-full" : "w-0",
              )}
            />
            <rect
              x="-80.6543"
              y="-64.2891"
              width="812"
              height="18.4616"
              transform="rotate(45 -80.6543 -64.2891)"
              fill="#FF3D0C"
              className={twMerge(
                "transition-all duration-[1s]",
                isActive ? "w-full" : "w-0",
              )}
            />
          </g>
          <g
            clipPath="url(#clip2_29_4178)"
            className="translate-x-[100%] scale-x-[-1]"
          >
            <rect
              x="-85.0547"
              y="-106.605"
              width="812"
              height="6.01367"
              transform="rotate(45 -85.0547 -106.605)"
              fill="#0064C7"
              className={twMerge(
                "transition-all delay-[0.4s] duration-[1s]",
                isActive ? "w-full" : "w-0",
              )}
            />
            <rect
              x="-83.957"
              y="-97.1367"
              width="812"
              height="9.11971"
              transform="rotate(45 -83.957 -97.1367)"
              fill="#38A430"
              className={twMerge(
                "transition-all delay-[0.3s] duration-[1s]",
                isActive ? "w-full" : "w-0",
              )}
            />
            <rect
              x="-82.8125"
              y="-83.541"
              width="812"
              height="12.358"
              transform="rotate(45 -82.8125 -83.541)"
              fill="#F9B700"
              className={twMerge(
                "transition-all delay-[0.2s] duration-[1s]",
                isActive ? "w-full" : "w-0",
              )}
            />
            <rect
              x="-80.6543"
              y="-64.2891"
              width="812"
              height="18.4616"
              transform="rotate(45 -80.6543 -64.2891)"
              fill="#FF3D0C"
              className={twMerge(
                "transition-all duration-[1s]",
                isActive ? "w-full" : "w-0",
              )}
            />
          </g>

          <g
            className={twMerge(
              "transform-fill-box transition-all duration-[1s]",
              isActive ? "scale-100" : "scale-0",
            )}
          >
            <path
              d="M418.453 481.815L461.082 480.253C470.506 479.907 478.065 472.348 478.411 462.924L479.973 420.297L481.536 462.924C481.881 472.348 489.441 479.907 498.864 480.253L541.493 481.815L498.864 483.377C489.441 483.723 481.881 491.283 481.536 500.706L479.973 543.333L478.411 500.706C478.065 491.283 470.506 483.723 461.082 483.377L418.453 481.815Z"
              fill="#D9D9D9"
              stroke="#D9D9D9"
              className="animate-rotate"
            />
          </g>
        </g>
        <defs>
          <clipPath id="clip0_29_4178">
            <rect width="960" height="575" fill="white" />
          </clipPath>
          <clipPath id="clip1_29_4178">
            <rect
              width="480"
              height="1117"
              fill="white"
              transform="translate(0 -415)"
            />
          </clipPath>
          <clipPath id="clip2_29_4178">
            <rect
              width="480"
              height="1117"
              fill="white"
              transform="translate(0 -415)"
            />
          </clipPath>
        </defs>
      </svg>
    </div>
  </div>
);
