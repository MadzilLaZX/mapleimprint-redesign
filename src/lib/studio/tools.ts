export type StudioToolId = "designs" | "uploads" | "text" | "graphics" | "shapes" | "my-stuff";

export interface StudioTool {
  id: StudioToolId;
  label: string;
}

export const STUDIO_TOOLS: StudioTool[] = [
  { id: "designs", label: "Designs" },
  { id: "uploads", label: "Uploads" },
  { id: "text", label: "Text" },
  { id: "graphics", label: "Graphics" },
  { id: "shapes", label: "Shapes" },
  { id: "my-stuff", label: "My Stuff" },
];
