import { createFileRoute } from "@tanstack/react-router";

import { AIAssistant } from "@/features/ai";

export const Route = createFileRoute("/_authenticated/ai/")({
  component: AIAssistant,
});
