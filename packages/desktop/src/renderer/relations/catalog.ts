import type { DatabaseSync } from "node:sqlite";
import {
  confirmRelation,
  discoverKnowledgeRelations,
  explainDiscoveryProposal,
  listConfirmedRelations,
  listSuggestedRelations,
  loadKnowledgeCard,
  rejectRelation,
  type KnowledgeRelationRecord,
} from "@bookskill/core";
import type { KnowledgeRelationView, RelationLists } from "./types.ts";

export function enrichRelation(db: DatabaseSync, relation: KnowledgeRelationRecord): KnowledgeRelationView {
  const fromCard = loadKnowledgeCard(db, relation.fromCardId);
  const toCard = loadKnowledgeCard(db, relation.toCardId);
  const proposal = explainDiscoveryProposal(fromCard, toCard);
  return {
    ...relation,
    fromCardTitle: fromCard.title,
    toCardTitle: toCard.title,
    reason: proposal?.reason ?? null,
  };
}

export function listSuggestedRelationViews(db: DatabaseSync): KnowledgeRelationView[] {
  return listSuggestedRelations(db).map((relation) => enrichRelation(db, relation));
}

export function listConfirmedRelationViews(db: DatabaseSync): KnowledgeRelationView[] {
  return listConfirmedRelations(db).map((relation) => enrichRelation(db, relation));
}

export function listRelationViews(db: DatabaseSync): RelationLists {
  return {
    suggested: listSuggestedRelationViews(db),
    confirmed: listConfirmedRelationViews(db),
  };
}

export function discoverAndListRelationViews(db: DatabaseSync): RelationLists {
  discoverKnowledgeRelations({ db });
  return listRelationViews(db);
}

export function confirmSuggestedRelations(db: DatabaseSync, relationIds: string[]): RelationLists {
  for (const relationId of relationIds) {
    confirmRelation({ db, relationId });
  }
  return listRelationViews(db);
}

export function rejectSuggestedRelations(db: DatabaseSync, relationIds: string[]): RelationLists {
  for (const relationId of relationIds) {
    rejectRelation({ db, relationId });
  }
  return listRelationViews(db);
}
