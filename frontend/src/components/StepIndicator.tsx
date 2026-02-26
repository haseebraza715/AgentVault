const STEP_ORDER = ["upload", "processing", "done"] as const;

type StudioStage = "idle" | "uploading" | "processing" | "done" | "error";

const LABELS: Record<(typeof STEP_ORDER)[number], string> = {
  upload: "Upload",
  processing: "Processing",
  done: "Done",
};

function isComplete(step: (typeof STEP_ORDER)[number], stage: StudioStage): boolean {
  if (step === "upload") return stage === "uploading" || stage === "processing" || stage === "done";
  if (step === "processing") return stage === "done";
  return step === "done" && stage === "done";
}

function isActive(step: (typeof STEP_ORDER)[number], stage: StudioStage): boolean {
  if (stage === "idle") return step === "upload";
  if (stage === "uploading") return step === "upload";
  if (stage === "processing") return step === "processing";
  if (stage === "done") return step === "done";
  return step === "processing";
}

export default function StepIndicator({ stage }: { stage: StudioStage }) {
  return (
    <div className="grid gap-1 rounded-lg border border-[#dbcdbd] bg-white p-1.5 sm:grid-cols-3">
      {STEP_ORDER.map((step, index) => {
        const complete = isComplete(step, stage);
        const active = isActive(step, stage);
        return (
          <div
            key={step}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
              complete
                ? "border-[#1f4d45] bg-[#ebf5f1] text-[#1f4d45]"
                : active
                  ? "border-[#cdbda8] bg-[#f6efe6] text-[#5f564c]"
                  : "border-[#e6dacd] bg-white text-[#8b7c6d]"
            }`}
          >
            <span
              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-semibold ${
                complete ? "bg-[#1f4d45] text-white" : "border border-[#cdbda8]"
              }`}
            >
              {complete ? "✓" : index + 1}
            </span>
            <span className="font-medium">{LABELS[step]}</span>
          </div>
        );
      })}
    </div>
  );
}
