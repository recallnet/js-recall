export const isValidUrl = (str: string) => {
  try {
    new URL(str);
    return true;
  } catch (e: any) {
    // this is to use the variable (eslint issues)
    console.log("image error", e.message);
    return false;
  }
};
