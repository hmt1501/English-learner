import { notFound } from "next/navigation";
import { scenarios, getScenario } from "@/lib/content";
import { ChatScenarioPlayer } from "@/components/chat/ChatScenarioPlayer";

export function generateStaticParams() {
  return scenarios.map((s) => ({ id: s.id }));
}

export default async function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenario = getScenario(id);
  if (!scenario) notFound();
  return <ChatScenarioPlayer scenario={scenario} />;
}
