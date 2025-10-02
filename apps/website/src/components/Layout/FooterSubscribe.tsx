import { useSubscribe } from "@/hooks/useSubscribe";

export const FooterSubscribe = ({
  heading,
  text,
}: {
  heading?: string;
  text?: string;
}) => {
  const { email, status, message, handleSubmit, setEmail } = useSubscribe({
    listType: "general",
    onSuccess: () => {},
  });

  return (
    <div className="relative z-30 w-full max-lg:px-9">
      <div className="flex max-w-[360px] flex-col gap-[15px]">
        <h3 className="text-[45px] font-bold leading-[0.95] tracking-[-2.34px] text-white lg:text-[78px]">
          {heading}
        </h3>
        <p className="text-gray max-w-[250px] pb-2 text-[16px] leading-[20px] lg:max-w-[320px] lg:text-[19px] lg:leading-[24px]">
          {text}
        </p>

        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="EMAIL"
              className="font-secondary text-gray placeholder:text-gray h-[45px] w-full border border-r-0 border-[#76818D] bg-transparent indent-[18px] text-[12px] focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="font-secondary h-[45px] whitespace-nowrap bg-[#E9EDF1] px-6 text-[12px] font-medium uppercase tracking-wide text-[#1D1F2B] transition-all duration-300 hover:bg-[#0064C7] hover:text-[#CED2D4]"
            >
              Sign up
            </button>
          </div>
        </form>
        {status === "loading" && (
          <p className="text-gray max-w-[216px] text-[16px] leading-[20px] opacity-80 lg:max-w-[320px]">
            Subscribing...
          </p>
        )}
        {status === "error" && (
          <p className="text-gray max-w-[216px] text-[16px] leading-[20px] opacity-80 lg:max-w-[320px]">
            Failed to subscribe: {message}
          </p>
        )}
        {status === "success" && (
          <p className="text-gray max-w-[216px] text-[16px] leading-[20px] opacity-80 lg:max-w-[320px]">
            Subscribed successfully!
          </p>
        )}
      </div>
    </div>
  );
};
