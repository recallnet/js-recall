export function formatDateRange(startDate: Date, endDate: Date) {
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // Options for specific parts of the date
  const dayMonthOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const fullDateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  // Function to format a date with specific options
  const formatUtil = (date: Date, options: Intl.DateTimeFormatOptions) => {
    // Using 'en-US' locale for 'Oct 26' or 'Oct 26, 2024' format
    return date.toLocaleDateString("en-US", options);
  };

  let startPart;
  let endPart;

  if (startYear === endYear && startMonth === endMonth) {
    // Case 1: Same month and year ("Oct 26-28, 2024")
    startPart = formatUtil(startDate, dayMonthOptions);
    endPart = endDate.getDate(); // Only the day number
    return `${startPart}-${endPart}, ${endYear}`;
  } else if (startYear === endYear) {
    // Case 2: Same year, different months ("Oct 26 - Nov 2, 2024")
    startPart = formatUtil(startDate, dayMonthOptions);
    endPart = formatUtil(endDate, dayMonthOptions);
    return `${startPart} - ${endPart}, ${endYear}`;
  } else {
    // Case 3: Different years ("Dec 26, 2024 - Jan 2, 2025")
    startPart = formatUtil(startDate, fullDateOptions);
    endPart = formatUtil(endDate, fullDateOptions);
    return `${startPart} - ${endPart}`;
  }
}
