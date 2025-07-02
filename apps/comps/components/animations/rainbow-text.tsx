const RainbowText = ({
  text,
  className = "",
}: {
  text: string;
  className: string;
}) => {
  return (
    <span
      className={`bg-gradient-to-r from-red-500 via-blue-500 via-green-500 via-orange-500 via-yellow-500 to-purple-500 bg-clip-text text-transparent ${className}`}
    >
      {text}
    </span>
  );
};

export default RainbowText;
