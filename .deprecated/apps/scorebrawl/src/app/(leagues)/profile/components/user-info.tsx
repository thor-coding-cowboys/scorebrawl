import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserInfo() {
  // In a real app, you'd fetch this data from your backend
  const user = {
    name: "Jane Doe",
    email: "jane.doe@example.com",
    avatarUrl: "https://example.com/avatar.jpg",
  };

  return (
    <div className="flex items-center space-x-4">
      <Avatar className="h-24 w-24">
        <AvatarImage src={user.avatarUrl} alt={user.name} />
        <AvatarFallback>
          {user.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>
      <div>
        <h2 className="text-2xl font-bold">{user.name}</h2>
        <p className="text-gray-500">{user.email}</p>
      </div>
    </div>
  );
}
