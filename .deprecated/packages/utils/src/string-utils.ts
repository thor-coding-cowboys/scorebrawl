export const getInitialsFromString = (value: string) => {
  if (!value) {
    return "";
  }
  const split = value.replaceAll("-", "").split(" ");
  let output = "";
  let i = 0;
  const len = split.length;
  for (i; i < len && output.length !== 2; i += 1) {
    const word = split[i] ?? "";
    if (word?.length > 0) {
      output += word[0];
    }
  }
  return output;
};

export const fullName = ({
  firstName,
  lastName,
}: {
  firstName: string | null;
  lastName: string | null;
}) => `${firstName || ""} ${lastName || ""}`.trim();

export const capitalize = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
