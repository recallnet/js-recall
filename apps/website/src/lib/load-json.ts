import competitionJson from "@/data/competitions.json";

export interface Competition {
  _id: string;
  _type: string;
  title: string;
  text: string;
  cta: string;
  ctaUrl: string;
}

export interface RewardsType {
  heading: string;
  subheading: string;
  activeCompetitions: Competition[];
  pastCompetitions: Competition[];
}
// Type for the raw competition data from JSON (without _id and _type)
type CompetitionInput = Omit<Competition, "_id" | "_type" | "cta">;

// Type for the raw JSON structure
interface CompetitionsJSON {
  heading: string;
  subheading: string;
  activeCompetitions: CompetitionInput[];
  pastCompetitions: CompetitionInput[];
}

/**
 * Validates that a competition has all required fields
 */
const validateCompetition = (
  competition: Record<string, unknown>,
  index: number,
  type: "active" | "past",
): void => {
  const requiredFields = ["title", "text", "ctaUrl"];
  const missingFields = requiredFields.filter((field) => !competition[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `Competition at index ${index} in ${type}Competitions is missing required fields: ${missingFields.join(
        ", ",
      )}`,
    );
  }
};

/**
 * Processes a competition to add generated _id and _type fields
 */
const processCompetition = (
  competition: CompetitionInput,
  index: number,
  type: "active" | "past",
): Competition => {
  return {
    _id: `${type}-${index + 1}`,
    _type: "competition",
    cta: type === "active" ? "VIEW COMPETITION" : "VIEW RESULTS",
    ...competition,
  };
};

/**
 * Parse and validate rewards data from the JSON file in `data/competitions.json`
 */
export const getCompetitionsData = (): RewardsType => {
  const data = competitionJson as CompetitionsJSON;

  // Validate top-level fields
  if (!data.heading || !data.subheading) {
    throw new Error("Invalid rewards data: missing heading or subheading");
  }

  // Validate that competitions are arrays
  if (
    !Array.isArray(data.activeCompetitions) ||
    !Array.isArray(data.pastCompetitions)
  ) {
    throw new Error("Invalid rewards data: competitions must be arrays");
  }

  // Validate and process competitions
  const activeCompetitions = data.activeCompetitions.map(
    (comp: CompetitionInput, index: number) => {
      validateCompetition(comp as Record<string, unknown>, index, "active");
      return processCompetition(comp, index, "active");
    },
  );

  const pastCompetitions = data.pastCompetitions.map(
    (comp: CompetitionInput, index: number) => {
      validateCompetition(comp as Record<string, unknown>, index, "past");
      return processCompetition(comp, index, "past");
    },
  );

  return {
    heading: data.heading,
    subheading: data.subheading,
    activeCompetitions,
    pastCompetitions,
  };
};

export const competitionsData = getCompetitionsData();
