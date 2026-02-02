import type { PlayerForm } from "@/model";
import { v4 as uuid } from "uuid";

export const FormDots = ({ form }: { form: PlayerForm }) => {
  return (
    <div className="flex gap-1">
      {form.map((r) => {
        if (r === "W") {
          return <div key={`${r}-${uuid()}`} className="h-2 w-2 rounded-full bg-green-400" />;
        }
        if (r === "D") {
          return (
            <div
              key={`${r}-${uuid()}`}
              className="h-2 w-2 rounded-full bg-yellow-500 dark:bg-yellow-400"
            />
          );
        }
        return <div key={`${r}-${uuid()}`} className="h-2 w-2 rounded-full bg-rose-900" />;
      })}
    </div>
  );
};
