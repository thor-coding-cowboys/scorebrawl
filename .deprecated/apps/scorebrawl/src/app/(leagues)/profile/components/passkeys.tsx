import { Button } from "@/components/ui/button";
import { Key, PlusCircle } from "lucide-react";

export function Passkeys() {
  // In a real app, you'd fetch this data from your backend
  const passkeys: string[] = [];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4">Passkeys</h3>
      {passkeys.length === 0 ? (
        <div className="text-center py-8">
          <Key className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No passkeys</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding a new passkey.</p>
          <div className="mt-6">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Passkey
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {passkeys.map((passkey) => (
            <li key={passkey} className="flex items-center">
              <Key className="mr-2 h-5 w-5" />
              <span>{passkey}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
