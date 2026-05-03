// Cosmetic filter: hide common ad elements
const AD_SELECTORS = [
  '[id*="ad-"]', '[class*="ad-"]', '[id*="banner"]',
  '[class*="banner"]', 'iframe[src*="doubleclick"]',
  'ins.adsbygoogle', '[data-ad-slot]'
].join(',');

function hideAds() {
  document.querySelectorAll(AD_SELECTORS).forEach(el => {
    el.style.setProperty('display', 'none', 'important');
  });
}

hideAds();
new MutationObserver(hideAds).observe(document.documentElement, {
  childList: true, subtree: true
});
