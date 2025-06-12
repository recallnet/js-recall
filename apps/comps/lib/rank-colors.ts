export const getRankColor = (position: number): string => {
  switch (position) {
    case 1:
      return "border-yellow-800";
    case 2:
      return "border-gray-700";
    case 3:
      return "border-[#1A0E05]";
    default:
      return "border-gray-700";
  }
};
