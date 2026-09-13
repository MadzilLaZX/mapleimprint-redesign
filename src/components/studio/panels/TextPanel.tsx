"use client";

export interface TextPreset {
  label: string;
  sampleSize: string;
  fontSize: number;
  bold: boolean;
}

const PRESETS: TextPreset[] = [
  { label: "Heading", sampleSize: "text-2xl", fontSize: 40, bold: true },
  { label: "Subheading", sampleSize: "text-lg", fontSize: 26, bold: false },
  { label: "Body text", sampleSize: "text-sm", fontSize: 18, bold: false },
];

/** Section 7's text tool starts here: one tap adds a ready-sized text box already selected and in
 *  edit mode (StudioClient wires that up), so the customer never faces a blank "Text" button with
 *  no sense of what happens next. */
export function TextPanel({ onAddText }: { onAddText: (preset: TextPreset) => void }) {
  return (
    <div className="space-y-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => onAddText(preset)}
          className="flex w-full flex-col items-start rounded-xl border border-sand px-4 py-3 text-left transition-colors hover:border-ink-950/30 hover:bg-canvas"
        >
          <span className={`font-display ${preset.sampleSize} ${preset.bold ? "font-semibold" : "font-normal"} text-ink-900`}>Add {preset.label.toLowerCase()}</span>
          <span className="mt-0.5 text-xs text-muted">Tap to place on your design</span>
        </button>
      ))}
    </div>
  );
}
