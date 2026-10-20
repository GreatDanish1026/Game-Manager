// Opens a game-page section (switching tabs if needed) and scrolls to it, or
// to a more specific element inside it once it has rendered.
export function openGameSection(sectionId, targetId = null) {
  window.dispatchEvent(
    new CustomEvent("game-manager-open-section", {
      detail: { id: sectionId },
    })
  );

  let attempts = 0;

  const scroll = () => {
    const target =
      (targetId ? document.getElementById(targetId) : null)
      ?? document.getElementById(`game-section-${sectionId}`);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (attempts < 10) {
      attempts += 1;
      window.setTimeout(scroll, 50);
    }
  };

  window.setTimeout(scroll, 60);
}
