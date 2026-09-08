/**
 * Optional guided-demo panel.
 *
 * A small, dismissible companion for the presenter: pick a journey, step
 * through it, and each step links to the screen it belongs on. Off by default
 * so it never intrudes on a screenshot.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { JOURNEYS } from "@/pages/walkthroughs";
import { IconChevronLeft, IconChevronRight, IconClose } from "@/odoo/icons";

const STORAGE_KEY = "wms.guided.open";

export function GuidedDemo() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [journeyId, setJourneyId] = useState(JOURNEYS[0].id);
  const [step, setStep] = useState(0);

  const journey = JOURNEYS.find((j) => j.id === journeyId) ?? JOURNEYS[0];

  const persist = (value: boolean) => {
    setOpen(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Storage may be unavailable; the panel still works for this session.
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="o-btn o-btn-secondary o-no-print fixed left-4 bottom-4 shadow-[var(--o-shadow)]"
        style={{ zIndex: 900 }}
        onClick={() => persist(true)}
        title="Open the guided demonstration panel"
      >
        Guided demo
      </button>
    );
  }

  return (
    <aside
      className="o-popover o-no-print fixed left-4 bottom-4 p-3"
      style={{ zIndex: 900, width: 340 }}
      aria-label="Guided demonstration"
    >
      <div className="flex items-center gap-2 mb-2">
        <strong className="text-[var(--o-fs-sm)]">Guided demo</strong>
        <button
          type="button"
          className="o-btn o-btn-ghost o-btn-sm ml-auto"
          onClick={() => persist(false)}
          aria-label="Close guided demo"
        >
          <IconClose size={11} />
        </button>
      </div>

      <select
        className="o-input mb-2"
        value={journeyId}
        onChange={(e) => {
          setJourneyId(e.target.value);
          setStep(0);
        }}
        aria-label="Journey"
      >
        {JOURNEYS.map((j) => (
          <option key={j.id} value={j.id}>
            {j.id} · {j.title}
          </option>
        ))}
      </select>

      <p className="text-[var(--o-fs-sm)] m-0 min-h-[52px]">
        <span className="text-[var(--o-text-subtle)] mr-1">
          {step + 1}/{journey.steps.length}
        </span>
        {journey.steps[step]}
      </p>

      <div className="flex items-center gap-1 mt-2">
        <button
          type="button"
          className="o-btn o-btn-secondary o-btn-sm"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <IconChevronLeft size={11} /> Back
        </button>
        <button
          type="button"
          className="o-btn o-btn-secondary o-btn-sm"
          disabled={step >= journey.steps.length - 1}
          onClick={() => setStep((s) => Math.min(journey.steps.length - 1, s + 1))}
        >
          Next <IconChevronRight size={11} />
        </button>
        <Link className="o-btn o-btn-primary o-btn-sm ml-auto" to={journey.to}>
          Go to start
        </Link>
      </div>

      {step === journey.steps.length - 1 && (
        <p className="mt-2 mb-0 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
          <strong>Expected outcome:</strong> {journey.outcome}
        </p>
      )}

      <Link
        to="/about/walkthroughs"
        className="block mt-2 text-[var(--o-fs-xs)]"
      >
        Full walkthroughs and presenting notes
      </Link>
    </aside>
  );
}
