(function () {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !("IntersectionObserver" in window)) return;

  const targets = Array.from(document.querySelectorAll(".hero, .preview, .section, .card, .footer"));
  if (!targets.length) return;

  root.classList.add("motion-ready");

  let cardIndex = 0;
  targets.forEach(element => {
    element.classList.add("reveal");
    if (element.classList.contains("card")) {
      element.style.setProperty("--reveal-delay", Math.min(cardIndex++, 5) * 65 + "ms");
    }
  });

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.08,
    rootMargin: "0px 0px -7% 0px"
  });

  targets.forEach(element => observer.observe(element));
})();
