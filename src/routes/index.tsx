import { createFileRoute } from "@tanstack/react-router";
import { SpaceSimulator } from "@/components/SpaceSimulator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Luna — Free Browser Space Simulator" },
      { name: "description", content: "Explore an interactive solar system in your browser. Pan, zoom, and click planets to learn more." },
    ],
  }),
  component: () => <SpaceSimulator />,
});
