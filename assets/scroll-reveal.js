(function () {
  "use strict";

  const targets = Array.from(document.querySelectorAll(
    ".top, .hero, .quick-check, .section, .card, .footer"
  ));
  if (!targets.length) return;

  // Content remains visible even if IntersectionObserver is unavailable or fails.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)) {
    targets.forEach(element => element.classList.add("is-visible"));
    return;
  }

  let cardIndex = 0;
  targets.forEach(element => {
    if (element.classList.contains("card")) {
      element.style.setProperty("--reveal-delay", Math.min(cardIndex++, 5) * 55 + "ms");
    }
  });

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.01, rootMargin: "0px 0px -4% 0px" });

  targets.forEach(element => observer.observe(element));
})();
