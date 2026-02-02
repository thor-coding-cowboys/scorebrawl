import { LeaguesList } from "./components/league-list";
import { LinkedAccounts } from "./components/linked-accounts";
import { Passkeys } from "./components/passkeys";
import { UserInfo } from "./components/user-info";

export default function ProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">User Profile</h1>
      <UserInfo />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
        <LinkedAccounts />
        <Passkeys />
      </div>
      <LeaguesList />
    </div>
  );
}
