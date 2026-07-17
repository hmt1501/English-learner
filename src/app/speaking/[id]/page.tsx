import { notFound } from "next/navigation";
import { dialogues, getDialogue } from "@/lib/content";
import { ShadowingPlayer } from "@/components/audio/ShadowingPlayer";

export function generateStaticParams() {
  return dialogues.map((d) => ({ id: d.id }));
}

export default async function SpeakingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dialogue = getDialogue(id);
  if (!dialogue) notFound();
  return <ShadowingPlayer dialogue={dialogue} />;
}
