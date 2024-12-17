export const stripArrayTypeIfPresent = (typeString: string) => {
  if (typeString?.match(/\S\[\]$/u) !== null) {
    return typeString.replace(/\[\]$/gu, '').trim();
  }
  return typeString;
};
