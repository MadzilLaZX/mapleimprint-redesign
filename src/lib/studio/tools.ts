export type StudioToolId = "designs" | "uploads" | "text" | "graphics" | "shapes" | "qr" | "my-stuff";

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
  { id: "qr", label: "QR Code" },
  { id: "my-stuff", label: "My Stuff" },
];
