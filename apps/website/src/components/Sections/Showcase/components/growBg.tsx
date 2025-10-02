import { motion } from "framer-motion";

export const GrowBg = ({ isActive }: { isActive: boolean }) => (
  <div className="bg-gradient-outer-grow absolute left-0 top-0 z-20 flex h-full w-full items-end justify-end overflow-hidden">
    <svg
      width="1440"
      height="758"
      viewBox="0 0 1440 758"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="max-lg:absolute max-lg:bottom-[60px] max-lg:left-1/2 max-lg:-z-10 max-lg:h-[500px] max-lg:w-auto max-lg:-translate-x-1/2"
    >
      <defs>
        <mask id="reveal-mask-1">
          <motion.rect
            initial={{ width: 0 }}
            animate={isActive ? { width: 1440 } : { width: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0 }}
            height="100%"
            fill="white"
          />
        </mask>
        <mask id="reveal-mask-2">
          <motion.rect
            initial={{ width: 0 }}
            animate={isActive ? { width: 1440 } : { width: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
            height="100%"
            fill="white"
          />
        </mask>
        <mask id="reveal-mask-3">
          <motion.rect
            initial={{ width: 0 }}
            animate={isActive ? { width: 1440 } : { width: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 1.0 }}
            height="100%"
            fill="white"
          />
        </mask>
        <mask id="reveal-mask-4">
          <motion.rect
            initial={{ width: 0 }}
            animate={isActive ? { width: 1440 } : { width: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 1.5 }}
            height="100%"
            fill="white"
          />
        </mask>
      </defs>
      <g clipPath="url(#clip0_30_4465)">
        <motion.path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="#FF3D0C"
          d="M1534.94 -8.65328L1263.87 262.413H1199.7L843.28 618.831H774.389L647.486 745.734H277V735.582H643.28L770.184 608.678H839.074L1195.49 252.261H1259.67L1527.76 -15.832L1534.94 -8.65328Z"
          mask="url(#reveal-mask-1)"
        />
        <motion.path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1547.99 -8.65328L1276.93 262.413H1212.75L856.332 618.831H787.442L660.538 745.734H290.053V735.582H656.333L783.237 608.678H852.127L1208.54 252.261H1272.72L1540.81 -15.832L1547.99 -8.65328Z"
          fill="#F9B700"
          mask="url(#reveal-mask-2)"
        />
        <motion.path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1286.23 252.261H1232.05H1222.05L865.631 608.678H806.741H796.741L669.837 735.582H313.557H303.557V745.734H313.557H674.042H684.042L810.946 618.831H869.836H879.836L1236.25 262.413H1290.43H1300.43L1571.5 -8.65328L1564.32 -15.832L1559.32 -10.832L1554.32 -15.832L1286.23 252.261Z"
          fill="#38A430"
          stroke="#38A430"
          mask="url(#reveal-mask-3)"
        />
        <motion.path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1246.55 252.261H1260.55H1274.55H1310.73L1578.82 -15.832L1585.82 -8.83201L1592.82 -15.832L1599.82 -8.83201L1606.82 -15.832L1614 -8.65328L1342.93 262.413H1328.93H1314.93H1278.76L922.339 618.831H908.339H894.339H853.449L726.545 745.734H712.545H698.545H356.06H342.06H328.06V735.582H342.06H356.06H694.34L821.243 608.678H835.243H849.244H890.134L1246.55 252.261Z"
          fill="#0064C7"
          mask="url(#reveal-mask-4)"
        />
      </g>
      <defs>
        <clipPath id="clip0_30_4465">
          <rect width="1440" height="850" fill="white" />
        </clipPath>
      </defs>
    </svg>
  </div>
);
