type EloRank = { name: string; short: string };

const tiers = [
  { name: "Gold", short: "G" },
  { name: "Platinum", short: "P" },
  { name: "Diamond", short: "D" },
  { name: "Champion", short: "C" },
  { name: "Grand Champion", short: "GC" },
];
const subRanks = ["I", "II", "III"];

const mockingTiers = [
  { name: "Casual", short: "CZ" },
  { name: "Newbie", short: "NB" },
  { name: "Clueless", short: "CL" },
  { name: "Hopeless", short: "HP" },
  { name: "Disaster", short: "DS" },
  { name: "Burden", short: "BD" },
  { name: "Dead Weight", short: "DW" },
  { name: "Why Bother?", short: "??" },
];
const rockBottom = { name: "Rock Bottom", short: "RB" };

export function getRankFromElo(elo: number): EloRank {
  // At or above 1200 → real ranks
  if (elo >= 1200) {
    const steps = Math.floor((elo - 1200) / 30); // how many 30-point jumps above 1200
    const tierIndex = Math.floor(steps / 3); // each tier has 3 subranks
    const subRankIndex = steps % 3;

    // If we’ve gone past Champion → Grand Champion loops forever
    if (tierIndex >= tiers.length - 1) {
      return {
        name: `Grand Champion ${subRanks[subRankIndex]}`,
        short: `GC${subRanks[subRankIndex]}`,
      };
    }

    const tier = tiers[tierIndex] as EloRank;
    return {
      name: `${tier.name} ${subRanks[subRankIndex]}`,
      short: `${tier.short}${subRanks[subRankIndex]}`,
    };
  }

  // 750 and below → worst
  if (elo <= 750) return rockBottom;

  // Below 1200 → mocking ranks, every 60 Elo down
  const idx = Math.min(mockingTiers.length - 1, Math.floor((1200 - elo) / 60));
  const tier = mockingTiers[idx] as EloRank;
  return { name: tier.name, short: tier.short };
}
