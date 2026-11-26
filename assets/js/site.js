/* buzzoffapp.com shared script (loaded with defer on every page).

   App Store clicks: every badge or "Get the app" link is
     <a class="appstore" data-placement="home-hero" href="https://apps.apple.com/app/apple-store/id6746517769?pt=127836285&ct=web-home&mt=8">
   The href (with the page-level campaign code) is static so it works without JS.
   This sends GA4's app_store_click with the per-button placement. Only the
   placement name is sent: nothing a visitor types on the site ever goes to GA. */
(function () {
  "use strict";

  document.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a.appstore") : null;
    if (!link || typeof window.gtag !== "function") return;
    window.gtag("event", "app_store_click", {
      event_category: "conversion",
      placement: link.getAttribute("data-placement") || "unknown",
      transport_type: "beacon",
    });
  });

  /* Sticky "Get the app" bar (home, mobile only; hidden by CSS at 768px+).
     Shows once the hero ([data-sticky-after]) has scrolled away, and hides
     while another App Store CTA ([data-sticky-hide] or the footer) is on
     screen, so there's never two at once. */
  var bar = document.querySelector(".sticky-cta");
  var hero = document.querySelector("[data-sticky-after]");
  var hiders = document.querySelectorAll("[data-sticky-hide], .site-footer");
  if (bar && hero && "IntersectionObserver" in window) {
    var heroVisible = true;
    var hidersVisible = new Set();
    var update = function () {
      var show = !heroVisible && hidersVisible.size === 0;
      bar.classList.toggle("is-visible", show);
      bar.setAttribute("aria-hidden", show ? "false" : "true");
      bar.querySelectorAll("a").forEach(function (a) {
        if (show) a.removeAttribute("tabindex");
        else a.setAttribute("tabindex", "-1");
      });
    };
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      update();
    }).observe(hero);
    var hideObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) hidersVisible.add(entry.target);
        else hidersVisible.delete(entry.target);
      });
      update();
    });
    hiders.forEach(function (el) {
      hideObserver.observe(el);
    });
    update();
  }
})();
