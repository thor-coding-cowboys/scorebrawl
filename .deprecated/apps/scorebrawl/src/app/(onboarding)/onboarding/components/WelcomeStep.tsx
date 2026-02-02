import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

export const WelcomeStep = () => {
  return (
    <>
      <CardHeader>
        <CardTitle>Welcome to Scorebrawl</CardTitle>
        <CardDescription>Where every point counts, every victory matters</CardDescription>
      </CardHeader>
      <CardContent className={"flex items-center"}>
        <p className="text-sm">
          ScoreBrawl is the ultimate battleground for tracking and amplifying your competitive edge!
          Whether you're conquering video games or dominating office games like pool and darts,
          ScoreBrawl is your go-to arena for registering and settling scores with friends,
          colleagues, or in real competitions. Fuel the fun, ignite the rivalry, and show off your
          victories! Bragging rights are just a score away with ScoreBrawl!
        </p>
        <Image
          priority={true}
          src="/scorebrawl.jpg"
          width={160}
          height={160}
          alt="welcome"
          className="rounded-lg"
        />
      </CardContent>
    </>
  );
};
