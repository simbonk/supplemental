// Anonymous visit counts through Vercel Web Analytics, which sets no cookies.
// Only the bare app address is sent, once per launch: the #route is dropped so
// nothing about which day, issue or goal you opened leaves the phone.
let sent = false;
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
window.va('beforeSend', (event) => {
  if (sent || event.type !== 'pageview') return null;
  sent = true;
  return { ...event, url: location.origin + location.pathname };
});
