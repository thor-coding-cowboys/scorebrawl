import { LeagueForm } from "@/components/league/league-form";
import { Title } from "@/components/title";

const CreateLeague = () => {
  return (
    <div className="container pt-4">
      <Title title={"Create League"} />
      <LeagueForm buttonTitle={"Create League"} />
    </div>
  );
};

export default CreateLeague;
