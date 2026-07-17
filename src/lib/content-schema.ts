import { z } from "zod";

export const TopicSchema = z.object({
  id: z.string(),
  titleVi: z.string(),
  emoji: z.string(),
  descriptionVi: z.string(),
});

export const VocabCardSchema = z.object({
  id: z.string(),
  chunk: z.string(),
  meaningVi: z.string(),
  example: z.string(),
  exampleVi: z.string(),
  /** Tình huống tiếng Việt dùng cho bài tái tạo (VI → EN) */
  cue: z.string(),
  /** Câu ví dụ có chỗ trống, ví dụ "I'll ___ ___ to you shortly." */
  cloze: z.string().optional(),
  audio: z.string(),
});

export const VocabDeckSchema = z.object({
  id: z.string(),
  topic: z.string(),
  titleVi: z.string(),
  cards: z.array(VocabCardSchema).min(1),
});

export const DialogueLineSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  textVi: z.string(),
  audio: z.string(),
});

export const DialogueQuestionSchema = z.object({
  qVi: z.string(),
  options: z.array(z.string()).min(2),
  answer: z.number().int().min(0),
});

export const DialogueSchema = z.object({
  id: z.string(),
  topic: z.string(),
  titleVi: z.string(),
  level: z.number().int().min(1).max(3),
  lines: z.array(DialogueLineSchema).min(2),
  questions: z.array(DialogueQuestionSchema).min(1),
});

export const ChatMessageSchema = z.object({
  from: z.string(),
  text: z.string(),
});

export const ModelAnswerSchema = z.object({
  style: z.enum(["formal", "neutral", "friendly"]),
  text: z.string(),
});

export const ChatScenarioSchema = z.object({
  id: z.string(),
  topic: z.string(),
  titleVi: z.string(),
  contextVi: z.string(),
  taskVi: z.string(),
  thread: z.array(ChatMessageSchema).min(1),
  hints: z.array(z.string()),
  modelAnswers: z.array(ModelAnswerSchema).min(1),
  rubricVi: z.array(z.string()).min(1),
  /** Id các thẻ SRS liên quan (phải tồn tại trong decks) */
  srsCards: z.array(z.string()),
});

export type Topic = z.infer<typeof TopicSchema>;
export type VocabCard = z.infer<typeof VocabCardSchema>;
export type VocabDeck = z.infer<typeof VocabDeckSchema>;
export type DialogueLine = z.infer<typeof DialogueLineSchema>;
export type Dialogue = z.infer<typeof DialogueSchema>;
export type ChatScenario = z.infer<typeof ChatScenarioSchema>;
export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;
