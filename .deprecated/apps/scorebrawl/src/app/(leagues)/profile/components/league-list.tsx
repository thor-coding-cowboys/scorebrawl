import { Users } from "lucide-react";

export function LeaguesList() {
  // In a real app, you'd fetch this data from your backend
  const leagues = [
    { name: "Premier League", role: "Player" },
    { name: "Local Basketball Association", role: "Coach" },
    { name: "City Chess Club", role: "Member" },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow mt-8">
      <h3 className="text-xl font-semibold mb-4">Leagues & Organizations</h3>
      <ul className="space-y-4">
        {leagues.map((league) => (
          <li key={league.name} className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            <span className="font-medium">{league.name}</span>
            <span className="ml-2 text-sm text-gray-500">({league.role})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
