export const stripArrayTypeIfPresent = (typeString: string) => {
  if(typeString && typeString.match(/\S\[\]$/u) !== null) {
    return typeString.replace(/\[\]$/gu, '').trim();
  }
  return typeString;
}
