import {
  Bug,
  ChevronRight,
  Gamepad2,
  Gauge,
  PlayCircle,
} from "lucide-react";

import { useState } from "react";

const SYMPTOMS = [
  {
    id: "launch",
    title: "Game won't launch",
    description: "The game never opens or closes immediately.",
    icon: PlayCircle,
    steps: [
      {
        label: "Analyze the launch",
        detail: "Starts the current launch profile and watches for an early exit.",
        targetId: "diagnostic-launch-failure",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
      {
        label: "Check runtimes and dependencies",
        detail: "Look for missing or incompatible local requirements.",
        targetId: "diagnostic-runtime-dependencies",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
      {
        label: "Validate configuration",
        detail: "Check settings files for damage or implausible values.",
        targetId: "diagnostic-configuration-validator",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
    ],
  },
  {
    id: "crash",
    title: "Crashes or hangs",
    description: "The game starts, then stops responding or exits.",
    icon: Bug,
    steps: [
      {
        label: "Find crash evidence",
        detail: "Review recent records after reproducing the crash.",
        targetId: "diagnostic-crash-detective",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
      {
        label: "Check known issues",
        detail: "Look for game-specific fixes and unresolved problems.",
        targetId: "troubleshooting-known-issues",
        sectionIds: ["technical-troubleshooting"],
      },
      {
        label: "Validate configuration",
        detail: "Rule out damaged or conflicting settings.",
        targetId: "diagnostic-configuration-validator",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
    ],
  },
  {
    id: "performance",
    title: "Poor performance",
    description: "Stutter, low frame rates, or uneven frame pacing.",
    icon: Gauge,
    steps: [
      {
        label: "Scan system conditions",
        detail: "Check common contributors without changing game files.",
        targetId: "diagnostic-windows-performance",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
      {
        label: "Capture a repeatable scene",
        detail: "Measure frame times and compare captures.",
        targetId: "diagnostic-performance-capture",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
      {
        label: "Validate display setup",
        detail: "Review refresh rate, HDR, and display configuration.",
        targetId: "diagnostic-display",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
    ],
  },
  {
    id: "controller",
    title: "Controller issues",
    description: "Missing input, wrong prompts, or double input.",
    icon: Gamepad2,
    steps: [
      {
        label: "Check controller support and conflicts",
        detail: "Review reported support, connected devices, and remappers.",
        targetId: "game-section-controller-support",
        sectionIds: ["pc-features", "controller-support"],
      },
      {
        label: "Inspect background apps",
        detail: "Find active tools that could affect game input.",
        targetId: "diagnostic-background-apps",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
      {
        label: "Try a clean launch",
        detail: "Temporarily isolate selected background apps before launch.",
        targetId: "diagnostic-clean-launch",
        sectionIds: ["technical-troubleshooting", "advanced-diagnostics"],
      },
    ],
  },
];

function openStep(step) {
  step.sectionIds.forEach((id, index) => {
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("game-manager-open-section", { detail: { id } })
      );
    }, index * 90);
  });

  window.setTimeout(() => {
    document.getElementById(step.targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, step.sectionIds.length * 90 + 100);
}

export default function TroubleshootingGuide() {
  const [selectedId, setSelectedId] = useState(null);
  const selected = SYMPTOMS.find((symptom) => symptom.id === selectedId);

  return (
    <section className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.035] p-4 sm:p-5" aria-labelledby="troubleshooting-guide-title">
      <h3 id="troubleshooting-guide-title" className="text-base font-semibold text-white/90">
        What is going wrong?
      </h3>
      <p className="mt-1 text-sm text-white/55">
        Choose a symptom to find the most useful existing checks. Nothing runs until you open a tool and start it.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {SYMPTOMS.map((symptom) => {
          const Icon = symptom.icon;
          const selectedCard = symptom.id === selectedId;

          return (
            <button
              key={symptom.id}
              type="button"
              aria-pressed={selectedCard}
              onClick={() => setSelectedId(selectedCard ? null : symptom.id)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${selectedCard ? "border-cyan-300/35 bg-cyan-400/[0.11]" : "border-white/10 bg-black/15 hover:border-cyan-300/20 hover:bg-white/[0.04]"}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200/80" />
              <span>
                <span className="block text-sm font-semibold text-white/85">{symptom.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{symptom.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4" aria-live="polite">
          <h4 className="text-sm font-semibold text-white/80">Suggested checks for {selected.title.toLowerCase()}</h4>
          <ol className="mt-3 space-y-2">
            {selected.steps.map((step, index) => (
              <li key={step.targetId} className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-semibold text-cyan-200">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white/75">{step.label}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-white/50">{step.detail}</div>
                </div>
                <button type="button" onClick={() => openStep(step)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cyan-300/20 px-2.5 py-1.5 text-xs font-semibold text-cyan-100/80 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                  Open <ChevronRight className="h-3.5 w-3.5" />
                  <span className="sr-only">{step.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
