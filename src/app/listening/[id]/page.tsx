import { notFound } from "next/navigation";
import { dialogues, getDialogue } from "@/lib/content";
import { DialoguePlayer } from "@/components/audio/DialoguePlayer";

export function generateStaticParams() {
  return dialogues.map((d) => ({ id: d.id }));
}

export default async function ListeningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dialogue = getDialogue(id);
  if (!dialogue) notFound();
  return <DialoguePlayer dialogue={dialogue} />;
}
