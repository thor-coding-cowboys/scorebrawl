import { Button } from "@/components/ui/button";
import { ChromeIcon, Github, PlusCircle } from "lucide-react";

export function LinkedAccounts() {
  // In a real app, you'd fetch this data from your backend
  const linkedAccounts = [
    { provider: "GitHub", icon: Github },
    { provider: "Google", icon: ChromeIcon },
  ];

  return (
    <div className="p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4">Linked Accounts</h3>
      <ul className="space-y-4">
        {linkedAccounts.map((account) => (
          <li key={account.provider} className="flex items-center">
            <account.icon className="mr-2 h-5 w-5" />
            <span>{account.provider}</span>
          </li>
        ))}
      </ul>
      <Button className="mt-4" variant="outline">
        <PlusCircle className="mr-2 h-4 w-4" />
        Link Account
      </Button>
    </div>
  );
}
