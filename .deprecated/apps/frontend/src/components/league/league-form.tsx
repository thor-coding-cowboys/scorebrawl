import { useState } from "react";

export const DEFAULT_LEAGUE_LOGO =
  "https://utfs.io/f/c5562abd-47aa-46de-b6a9-936b4cef1875_mascot.png";

export const LeagueForm = () => {
  const [logo] = useState<string>(DEFAULT_LEAGUE_LOGO);

  return (
    <div className="grid grid-rows-2 gap-8 sm:grid-cols-2">
      <div className="flex h-full w-full flex-col items-center justify-start gap-4 sm:justify-end">
        <img width={160} height={160} src={logo} alt="logo" />
      </div>
    </div>
  );
};
