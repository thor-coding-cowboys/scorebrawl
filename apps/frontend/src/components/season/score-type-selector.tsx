import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import { Table, Trophy } from "lucide-react";

interface ScoreTypeSelectorProps {
  leagueSlug: string;
}

export function ScoreTypeSelector({ leagueSlug }: ScoreTypeSelectorProps) {
  const navigate = useNavigate();

  const handleSelectScoreType = (scoreType: "elo" | "3-1-0") => {
    navigate({
      to: "/leagues/$leagueSlug/seasons/create-form",
      params: { leagueSlug },
      search: { scoreType },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, scoreType: "elo" | "3-1-0") => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelectScoreType(scoreType);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Choose Scoring System</h2>
        <p className="text-muted-foreground">
          Select how you want to track player performance in this season
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ELO Card */}
        <button
          type="button"
          aria-label="Select ELO Rating scoring system"
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={() => handleSelectScoreType("elo")}
          onKeyDown={(e) => handleKeyDown(e, "elo")}
        >
          <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md h-full">
            <CardHeader>
              <Trophy className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>ELO Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create a season using the Elo Points System. A higher K-Factor may lead to more
                volatile ratings, while a lower K-Factor results in more stable ratings over time.
              </p>
            </CardContent>
          </Card>
        </button>

        {/* 3-1-0 Card */}
        <button
          type="button"
          aria-label="Select 3-1-0 Points scoring system"
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={() => handleSelectScoreType("3-1-0")}
          onKeyDown={(e) => handleKeyDown(e, "3-1-0")}
        >
          <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md h-full">
            <CardHeader>
              <Table className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>3-1-0 Points</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create a season using the Standard 3-1-0 Points System, where teams earn 3 points
                for a win, 1 point for a draw, and 0 points for a loss. A straightforward scoring
                system for clear and simple match outcomes.
              </p>
            </CardContent>
          </Card>
        </button>
      </div>
    </div>
  );
}
