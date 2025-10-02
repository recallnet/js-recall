import Link from "next/link";

export const RewardsCard = ({
  title,
  description,
  link,
  linkText,
}: {
  title: string;
  description: string;
  link: string;
  linkText: string;
}) => {
  return (
    <div className="clip-path-polygon group relative w-full bg-[#15191F] transition-all duration-300 ease-in-out hover:bg-[#1E2329]">
      <div className="flex w-full flex-col gap-3 max-lg:px-10 max-lg:pt-[30px] lg:h-[227px] lg:flex-row lg:gap-0">
        <div className="flex h-full flex-col justify-end lg:w-1/2 lg:px-10 lg:pb-6">
          <div className="absolute -left-5 -top-2 -z-10 w-full lg:left-0 lg:top-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 400 114"
              fill="none"
              className="h-auto w-[280px] text-[#15191F] transition-all duration-300 ease-in-out group-hover:text-[#1E2329] lg:h-[114px] lg:w-[400px]"
            >
              <g clipPath="url(#a)">
                <path
                  fill="#0064C7"
                  fillRule="evenodd"
                  d="m310.352 102.142-74.977-74.978v-42.57h45.166l71.836 71.837v45.711h-42.025Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#38A430"
                  fillRule="evenodd"
                  d="m266.815 58.603-74.979-74.978v-42.568h45.168l71.835 71.835v45.712h-42.024Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#F9B700"
                  fillRule="evenodd"
                  d="m235.252 27.127-74.978-74.978V-90.42h45.167l71.836 71.836v45.711h-42.025Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#0064C7"
                  fillRule="evenodd"
                  d="m226.084 104.364-74.978-74.977v-42.57h45.167l71.836 71.836v45.711h-42.025Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#38A430"
                  fillRule="evenodd"
                  d="m182.544 60.826-74.979-74.978v-42.569h45.168l71.835 71.835v45.712h-42.024Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#F9B700"
                  fillRule="evenodd"
                  d="M150.985 29.35 76.007-45.628v-42.57h45.167L193.01-16.36v45.71h-42.025Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#0064C7"
                  fillRule="evenodd"
                  d="M139.574 104.364 64.597 29.387v-42.57h45.166l71.836 71.837v45.71h-42.025Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#38A430"
                  fillRule="evenodd"
                  d="M96.038 60.826 21.061-14.15v-42.57h45.167l71.835 71.836v45.711H96.038Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#F9B700"
                  fillRule="evenodd"
                  d="m64.473 29.35-74.978-74.978v-42.57h45.167l71.836 71.837v45.71H64.473Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#0064C7"
                  fillRule="evenodd"
                  d="m53.074 104.364-74.977-74.977v-42.57h45.166L95.1 58.654v45.711H53.074Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#38A430"
                  fillRule="evenodd"
                  d="M9.532 60.826-65.445-14.15v-42.57h45.166l71.836 71.836v45.711H9.532Z"
                  clipRule="evenodd"
                />
                <path
                  fill="#F9B700"
                  fillRule="evenodd"
                  d="m-22.027 29.35-74.977-74.978v-42.57h45.166L19.998-16.36v45.71h-42.025Z"
                  clipRule="evenodd"
                />
                <path fill="url(#b)" d="M-.5.249h400.194v113.663H-.5z" />
              </g>
              <defs>
                <linearGradient
                  id="b"
                  x1="214.783"
                  x2="214.783"
                  y1="-2.908"
                  y2="113.912"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="currentColor" stopOpacity="0" />
                  <stop offset="1" stopColor="currentColor" />
                </linearGradient>
                <clipPath id="a">
                  <path
                    fill="#fff"
                    d="M-126.5-119.865h526.194v233.778H-126.5z"
                  />
                </clipPath>
              </defs>
            </svg>
          </div>
          <h3 className="text-[20px] font-bold leading-[1.21] tracking-[-0.01em] text-white max-lg:max-w-[220px] lg:min-h-[90px] lg:text-[28px]">
            {title}
          </h3>
        </div>
        <div className="flex h-full flex-col gap-[18px] border-[#212C3A] pb-4 lg:w-1/2 lg:gap-0 lg:border-l lg:pb-0">
          <div className="flex grow flex-col max-lg:max-w-[260px] lg:pl-11 lg:pr-14 lg:pt-11">
            <p className="text-[rgba(255, 255, 255, 0.58)] text-[19px] leading-[1.21] opacity-80 transition-all duration-300 ease-in-out group-hover:-translate-y-1 group-hover:opacity-100">
              {description}
            </p>
          </div>
          <div className="flex shrink-0 flex-col border-[#212C3A] lg:border-t">
            <Link
              className="flex h-[44px] items-center justify-between text-white after:absolute after:inset-0 after:content-[''] lg:h-[64px] lg:px-10"
              href={link}
              target="_blank"
            >
              <span className="font-secondary text-[12px] font-medium uppercase leading-[1] tracking-[0.13em]">
                {linkText}
              </span>
              <span>
                <svg
                  width="10"
                  height="17"
                  viewBox="0 0 10 17"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-50 transition-all duration-300 ease-in-out group-hover:translate-x-1 group-hover:opacity-100"
                >
                  <path
                    d="M4.71552 13.75V12.723L7.64052 9.902H0.0615234V8.498H7.64052L4.71552 5.677V4.65H5.84652L9.94152 8.758V9.655L5.84652 13.75H4.71552Z"
                    fill="#E9EDF1"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
