import type { DatabaseSync } from "node:sqlite";
import {
  listConfirmedRelations,
  listSuggestedRelations,
  loadKnowledgeCard,
  type KnowledgeRelationRecord,
} from "@bookskill/core";
import type { KnowledgeRelationView, RelationLists } from "./types.ts";

export function enrichRelation(db: DatabaseSync, relation: KnowledgeRelationRecord): KnowledgeRelationView {
  const fromCard = loadKnowledgeCard(db, relation.fromCardId);
  const toCard = loadKnowledgeCard(db, relation.toCardId);
  return {
    ...relation,
    fromCardTitle: fromCard.title,
    toCardTitle: toCard.title,
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
