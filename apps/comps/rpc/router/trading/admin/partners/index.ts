import { addPartnerToCompetition } from "./add-to-competition";
import { createPartner } from "./create";
import { deletePartner } from "./delete";
import { getPartnerById } from "./get-by-id";
import { getCompetitionPartners } from "./get-competition-partners";
import { listPartners } from "./list";
import { removePartnerFromCompetition } from "./remove-from-competition";
import { updatePartner } from "./update";

export const partners = {
  create: createPartner,
  list: listPartners,
  getById: getPartnerById,
  update: updatePartner,
  delete: deletePartner,
  addToCompetition: addPartnerToCompetition,
  getCompetitionPartners: getCompetitionPartners,
  removeFromCompetition: removePartnerFromCompetition,
} as const;
