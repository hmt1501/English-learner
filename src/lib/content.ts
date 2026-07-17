// Bộ nạp nội dung tĩnh — toàn bộ JSON được bundle vào app lúc build.
import type { Topic, VocabDeck, VocabCard, Dialogue, ChatScenario } from "./content-schema";

import topicsJson from "../../content/topics.json";

import deckCep from "../../content/decks/chat-email-phrases.json";
import deckMtg from "../../content/decks/meetings.json";
import deckStr from "../../content/decks/status-reporting.json";
import deckAfh from "../../content/decks/asking-for-help.json";
import deckSch from "../../content/decks/scheduling.json";
import deckSmt from "../../content/decks/small-talk.json";
import deckReq from "../../content/decks/requests-permissions.json";
import deckPro from "../../content/decks/problems-apologies.json";

import dlgMeetings01 from "../../content/dialogues/meetings-01.json";
import dlgStatus01 from "../../content/dialogues/status-01.json";
import dlgHelp01 from "../../content/dialogues/help-01.json";
import dlgSmalltalk01 from "../../content/dialogues/smalltalk-01.json";
import dlgProblems01 from "../../content/dialogues/problems-01.json";
import dlgScheduling01 from "../../content/dialogues/scheduling-01.json";

import scScheduling01 from "../../content/scenarios/sc-scheduling-01.json";
import scCep01 from "../../content/scenarios/sc-cep-01.json";
import scMeetings01 from "../../content/scenarios/sc-meetings-01.json";
import scStatus01 from "../../content/scenarios/sc-status-01.json";
import scHelp01 from "../../content/scenarios/sc-help-01.json";
import scSmalltalk01 from "../../content/scenarios/sc-smalltalk-01.json";
import scReq01 from "../../content/scenarios/sc-req-01.json";
import scProblems01 from "../../content/scenarios/sc-problems-01.json";

export const topics = topicsJson as Topic[];

export const decks = [deckCep, deckMtg, deckStr, deckAfh, deckSch, deckSmt, deckReq, deckPro] as VocabDeck[];

export const dialogues = [
  dlgMeetings01,
  dlgStatus01,
  dlgHelp01,
  dlgSmalltalk01,
  dlgProblems01,
  dlgScheduling01,
] as Dialogue[];

export const scenarios = [
  scScheduling01,
  scCep01,
  scMeetings01,
  scStatus01,
  scHelp01,
  scSmalltalk01,
  scReq01,
  scProblems01,
] as ChatScenario[];

export const allCards: VocabCard[] = decks.flatMap((d) => d.cards);

const cardById = new Map(allCards.map((c) => [c.id, c]));
export function getCard(id: string): VocabCard | undefined {
  return cardById.get(id);
}

export function getDeck(id: string): VocabDeck | undefined {
  return decks.find((d) => d.id === id);
}

export function getDialogue(id: string): Dialogue | undefined {
  return dialogues.find((d) => d.id === id);
}

export function getScenario(id: string): ChatScenario | undefined {
  return scenarios.find((s) => s.id === id);
}

export function getTopic(id: string): Topic | undefined {
  return topics.find((t) => t.id === id);
}
