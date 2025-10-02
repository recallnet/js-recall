import { useEffect, useState } from "react";

const gridTemplate = ["a", "a", "a", "a", "a", "", "", "a", "a", "a", "a", "a"];

type variants = number[];
export const FrameItem = ({ variant }: { variant: variants }) => {
  const svgGroups = [
    <g key="1">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M107.5 84.8906V108H49.9992L0 58.0008V0H22.6094L107.5 84.8906Z"
        fill="#FF3D0C"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M224.5 84.8906V108H166.999L117 58.0008V0H139.609L224.5 84.8906Z"
        fill="#0064C7"
      />
    </g>,
    <g key="2">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.5 84.8906V108H58.0008L108 58.0008V0H85.3906L0.5 84.8906Z"
        fill="#F9B700"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M224.5 84.8906V108H166.999L117 58.0008V0H139.609L224.5 84.8906Z"
        fill="#FF3D0C"
      />
    </g>,
    <g key="3">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.5 84.8906V108H58.0008L108 58.0008V0H85.3906L0.5 84.8906Z"
        fill="#0064C7"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M117.5 84.8906V108H175.001L225 58.0008V0H202.391L117.5 84.8906Z"
        fill="#F9B700"
      />
    </g>,
    <g key="4">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.5 84.8906V108H58.0008L108 58.0008V0H85.3906L0.5 84.8906Z"
        fill="#38A430"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M117.5 84.8906V108H175.001L225 58.0008V0H202.391L117.5 84.8906Z"
        fill="#0064C7"
      />
    </g>,
    <g key="5">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.5 84.8906V108H58.0008L108 58.0008V0H85.3906L0.5 84.8906Z"
        fill="#0064C7"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M117.5 84.8906V108H175.001L225 58.0008V0H202.391L117.5 84.8906Z"
        fill="#FF3D0C"
      />
    </g>,
    <g key="6">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M107.5 84.8906V108H49.9992L0 58.0008V0H22.6094L107.5 84.8906Z"
        fill="#38A430"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M117.5 84.8906V108H175.001L225 58.0008V0H202.391L117.5 84.8906Z"
        fill="#FF3D0C"
      />
    </g>,
    <g key="7">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M107.5 84.8906V108H49.9992L0 58.0008V0H22.6094L107.5 84.8906Z"
        fill="#FF3D0C"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M224.5 84.8906V108H166.999L117 58.0008V0H139.609L224.5 84.8906Z"
        fill="#F9B700"
      />
    </g>,
    <g key="8">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M107.5 84.8906V108H49.9992L0 58.0008V0H22.6094L107.5 84.8906Z"
        fill="#38A430"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M224.5 84.8906V108H166.999L117 58.0008V0H139.609L224.5 84.8906Z"
        fill="#0064C7"
      />
    </g>,
    <g key="9">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M107.5 84.8906V108H49.9992L0 58.0008V0H22.6094L107.5 84.8906Z"
        fill="#F9B700"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M224.5 84.8906V108H166.999L117 58.0008V0H139.609L224.5 84.8906Z"
        fill="#38A430"
      />
    </g>,
  ];

  return (
    <div className="flex flex-col gap-[3px]">
      <svg
        viewBox="0 0 225 108"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-[48px] lg:h-[32px] lg:w-[68px]"
      >
        {variant[0] !== undefined && svgGroups[variant[0] - 1]}
      </svg>
      <svg
        viewBox="0 0 225 108"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-[48px] lg:h-[32px] lg:w-[68px]"
      >
        {variant[1] !== undefined && svgGroups[variant[1] - 1]}
      </svg>
    </div>
  );
};

export const FrameGrid = ({ isActive }: { isActive: boolean }) => {
  const [grid, setGrid] = useState<Array<Array<number> | null>>([]);

  const initializeGrid = (template: string[]) => {
    const newGrid = [];

    for (let i = 0; i < template.length; i++) {
      if (template[i] === "") {
        newGrid.push(null);
        continue;
      }

      const randomVariantA = Math.floor(Math.random() * 9 + 1);
      const randomVariantB = Math.floor(Math.random() * 9 + 1);

      newGrid.push([randomVariantA, randomVariantB]);
    }
    setGrid(newGrid);
  };

  useEffect(() => {
    initializeGrid(gridTemplate);

    const interval = setInterval(() => {
      if (!isActive) return;

      setGrid((prevGrid) => {
        const newGrid = [...prevGrid];

        for (let i = 0; i < newGrid.length; i++) {
          const currentVariant = newGrid[i];

          if (!currentVariant || currentVariant.length < 2) {
            continue;
          }

          const a = (currentVariant[0]! % 9) + 1;
          const b = (currentVariant[1]! % 9) + 1;

          newGrid[i] = [a, b];
        }

        return newGrid;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="cm-grid grid h-full w-full grid-cols-4 grid-rows-3">
        {grid.map((row, rowIndex) => (
          <div
            key={`${rowIndex}-${rowIndex}`}
            className="flex items-center justify-center"
          >
            {row && <FrameItem variant={row} />}
          </div>
        ))}
      </div>
    </div>
  );
};
