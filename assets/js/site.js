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
})();
