// Ad network blocklist
const BLOCKED = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adnxs.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net',
  'advertising.com', 'taboola.com', 'outbrain.com', 'moatads.com',
  'scorecardresearch.com', 'quantserve.com', 'amazon-adsystem.com'
];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      const host = new URL(details.url).hostname;
      if (BLOCKED.some(d => host === d || host.endsWith('.' + d)))
        return { cancel: true };
    } catch {}
    return {};
  },
  { urls: ['<all_urls>'] },
  ['blocking']
);
