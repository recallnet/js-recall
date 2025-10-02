import { motion } from "framer-motion";

import { useSubscribe } from "@/hooks/useSubscribe";

export const RewardsSubscribe = ({
  animationDelay,
  isInView,
}: {
  animationDelay: number;
  isInView: boolean;
}) => {
  const { email, status, message, handleSubmit, setEmail } = useSubscribe({
    listType: "comps",
    onSuccess: () => {},
  });

  return (
    <motion.div
      className="max-lg:clip-path-polygon w-full bg-[#C3CAD2] p-[1px] lg:border-t lg:border-[#C3CAD2] lg:bg-transparent lg:py-10 lg:pl-10 lg:pr-0"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : -10 }}
      transition={{ duration: 0.5, delay: animationDelay }}
    >
      <div className="max-lg:clip-path-polygon flex flex-col items-start justify-between gap-[10px] bg-[#F4F4F4] px-10 pb-9 pt-7 lg:flex-row lg:gap-8 lg:px-0 lg:pb-0 lg:pt-0">
        <div className="max-lg:max-w-[216px] lg:w-[275px]">
          <h3 className="text-mutedLight text-[20px] font-bold leading-[1.21] lg:text-[28px]">
            New Competitions Every Week
          </h3>
        </div>

        <div className="flex w-full flex-col-reverse gap-[22px] lg:w-[382px] lg:flex-col lg:gap-3">
          <form onSubmit={handleSubmit} className="w-full">
            <div className="flex w-full flex-col lg:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="EMAIL"
                className="font-secondary text-mutedLight placeholder:text-mutedLight h-[45px] w-full border border-[#76818D] bg-transparent indent-[18px] text-[12px] focus:outline-none lg:border-r-0"
                required
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="font-secondary h-[45px] whitespace-nowrap bg-[#1D1F2B] px-6 text-[12px] font-medium uppercase tracking-wide text-white transition-all duration-300 hover:bg-[#0064C7] hover:text-[#CED2D4]"
              >
                Notify Me
              </button>
            </div>
          </form>
          {status === "idle" && (
            <p className="text-mutedLight max-w-[216px] text-[16px] leading-[20px] opacity-80 lg:max-w-[320px]">
              Sign up for alerts about new competitions.
            </p>
          )}
          {status === "loading" && (
            <p className="text-mutedLight max-w-[216px] text-[16px] leading-[20px] opacity-80 lg:max-w-[320px]">
              Subscribing...
            </p>
          )}
          {status === "error" && (
            <p className="text-mutedLight max-w-[216px] text-[16px] leading-[20px] opacity-80 lg:max-w-[320px]">
              Failed to subscribe: {message}
            </p>
          )}
          {status === "success" && (
            <p className="text-mutedLight max-w-[216px] text-[16px] leading-[20px] opacity-80 lg:max-w-[320px]">
              Subscribed successfully!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
