importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// This dummy listener satisfies Android Chrome's strict PWA install rules to hide the URL bar
self.addEventListener('fetch', function(event) {});
