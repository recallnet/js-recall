export const MenuIcon = ({ isActive }: { isActive: boolean }) => (
  <>
    {isActive ? (
      <>
        {" "}
        <svg
          width="55"
          height="55"
          viewBox="0 0 55 55"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <mask id="path-1-inside-1_4182_5732" fill="white">
            <path d="M0 0H55V55H0V0Z" />
          </mask>
          <path
            d="M1 55V0H-1V55H1Z"
            fill="#212C3A"
            mask="url(#path-1-inside-1_4182_5732)"
          />
          <rect
            x="21.0479"
            y="18.9258"
            width="21.25"
            height="3"
            transform="rotate(45 21.0479 18.9258)"
            fill="#D9D9D9"
          />
          <rect
            x="18.9268"
            y="33.9531"
            width="21.25"
            height="3"
            transform="rotate(-45 18.9268 33.9531)"
            fill="#D9D9D9"
          />
        </svg>
      </>
    ) : (
      <>
        {" "}
        <svg
          width="55"
          height="55"
          viewBox="0 0 55 55"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <mask id="path-1-inside-1_4176_4268" fill="white">
            <path d="M0 0H55V55H0V0Z" />
          </mask>
          <path
            d="M1 55V0H-1V55H1Z"
            fill="#212C3A"
            mask="url(#path-1-inside-1_4176_4268)"
          />
          <rect x="16.875" y="18" width="21.25" height="3" fill="#D9D9D9" />
          <rect x="16.875" y="26" width="21.25" height="3" fill="#D9D9D9" />
          <rect x="16.875" y="34" width="21.25" height="3" fill="#D9D9D9" />
        </svg>
      </>
    )}
  </>
);
