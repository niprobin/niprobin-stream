# Casting audio from a PWA (Chromecast, AirPlay, DLNA/UPnP, Bluetooth)

Research date: 2026-11-06. Scope: what an installed web app can do to send audio to external devices, and what it means for **niprobin-stream** (this repo) and **body-music-vue**. Claims link to their source inline. Anything I couldn't confirm from a primary source is marked **(unverified)**. Nothing here was tested on real devices.

## TL;DR

- **There's no single cross-browser "cast" API.** Two standards exist: Remote Playback and Presentation. Chromium and Safari implement Remote Playback. Firefox implements neither ([browser-compat-data: RemotePlayback][bcd-rp], [Presentation][bcd-pres]).
- **Remote Playback API (`audio.remote.prompt()`) is the cheapest option.** It's one button on an existing `<audio>` element. It works in Chrome Android since 56, Chrome/Edge desktop since 121 and Safari/iOS since 13.1, where it targets AirPlay ([BCD][bcd-rp], [chromestatus][cs-rp]). The spec is still a W3C Editor's Draft ([spec][rp-spec]).
- **Chromium only allows Remote Playback for `http:`, `https:` or `file:` sources.** `blob:` URLs are refused ([Chromium `renderer_controller.cc`][cr-rc]). niprobin-stream plays every track from a `blob:` object URL ([ADR 0002](../adr/0002-download-before-play.md)), so Chromium's Remote Playback and its built-in cast button can't work there as the app is built today.
- **The Google Cast Web Sender SDK (`cast_sender.js`) gives full Chromecast control.** You get queue, metadata, volume, and the receiver can keep playing on its own. It runs in Cast-supported browsers on Mac, Windows, Linux, ChromeOS and Android, not on iOS, and the sender page must be served over HTTPS ([Cast web sender][cast-ws]). The **Default Media Receiver** needs no registration and no $5 developer account ([registration][cast-reg], [Web Receiver overview][cast-wr]).
- **A Cast receiver fetches the media URL itself.** The URL must be reachable from the Chromecast, so a `blob:` URL can't be used. Google requires CORS only for adaptive streaming (HLS/DASH), not for plain progressive files ([supported media][cast-media]). MP3, AAC, FLAC, Opus, Vorbis and WAV are all supported ([supported media][cast-media]).
- **The Presentation API isn't useful for audio playback.** It opens a whole web page on a second screen. Chromium ships it and Safari and Firefox don't ([BCD][bcd-pres], [spec][pres-spec]). The Cast SDK covers this need better.
- **On iOS and macOS the reliable route for audio is the OS route picker.** Control Center on iPhone/iPad and the Sound menu on Mac send "the current audio" to AirPlay speakers ([Apple: Use AirPlay to stream audio][apple-airplay-audio]). From script, WebKit offers `webkitShowPlaybackTargetPicker()` ([Apple developer doc][apple-airplay-btn]) and the standard `remote.prompt()`. Whether these work inside a Home Screen (standalone) web app is **unverified**.
- **Bluetooth and the Android Output Switcher work at the OS level.** No web API is needed: the system routes the page's audio like any other app's ([Android: routing between devices][android-routing]).
- **DLNA/UPnP (including the Denon amp the native app casts to) can't be reached from a normal web page.** SSDP discovery needs UDP multicast. Direct Sockets, which allows it, ships only to Isolated Web Apps ([chromestatus: Direct Sockets][cs-ds]). Chrome 142+ also puts local-network requests behind a permission prompt ([chromestatus: LNA][cs-lna]). The workable patterns are the native app (already built in `nipstream-native-app/src/cast/`) or a **controller on the home LAN** that the PWA calls.
- **Recommendation for niprobin-stream:** cast to Chromecast with the Cast Web Sender + Default Media Receiver, sending the `files.niprobin.com` URL rather than the blob. Leave DLNA to the native app.
- **Recommendation for body-music-vue:** add a Remote Playback button to the stream's `<audio>` element. That gives Cast on Chrome and AirPlay on Safari. The Icecast URL is public HTTPS MP3 and sends permissive CORS (checked below), so it can be cast as-is.

---

## 1. Google Cast Web Sender SDK (CAF)

**What it is.** A JS library loaded from `https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1`. You set `window.__onGCastApiAvailable`, call `cast.framework.CastContext.getInstance().setOptions({ receiverApplicationId, autoJoinPolicy })`, and drop in a `<google-cast-launcher>` button. Media is sent with `castSession.loadMedia(new chrome.cast.media.LoadRequest(mediaInfo))`. `RemotePlayer` and `RemotePlayerController` handle play/pause/seek and state ([integrate guide][cast-integrate]). `MediaInfo` takes a `contentId`/`contentUrl`, a `contentType`, a `streamType` and metadata. `duration` "may be null for media with type `StreamType.LIVE`" ([MediaInfo reference][cast-mediainfo]).

**Where it runs.**

| Platform | Supported? | Source |
|---|---|---|
| Chrome on Mac / Windows / Linux / ChromeOS | Yes ("Cast-supported web browsers") | [cast-ws] |
| Chrome on Android | Yes (Android listed) | [cast-ws] |
| Chrome on iOS | No ("casting isn't supported in the iOS Chrome browser") | [cast-ws] |
| Safari (any), Firefox | Not listed. They lack the Presentation API the SDK relies on, see section 3 (**unverified** that the SDK is fully inert there) | [cast-ws], [bcd-pres] |
| Edge / other Chromium browsers | Not mentioned by Google (**unverified**) | [cast-ws] |
| Installed PWA (standalone window) on Chrome desktop / Android | Not mentioned by Google (**unverified**). Nothing in the docs excludes it, and the HTTPS requirement is met. | [cast-ws] |
| Insecure (http) origin | No: "Web Sender apps need to support HTTPS" | [cast-ws] |

**Receivers.**

| Receiver | Registration | Customisation | Source |
|---|---|---|---|
| Default Media Receiver (`chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID`) | None: "you do not have to register your application" | None ("you cannot customize any of the UI") | [cast-reg], [cast-wr], [cast-integrate] |
| Styled Media Receiver | Required ($5 one-off developer fee) | CSS / branding | [cast-reg], [cast-wr] |
| Custom Web Receiver | Required. Must be hosted over TLS. Test devices must be registered, then wait about 15 min and reboot. | Anything (HTML5 app) | [cast-reg], [cast-wr-basic] |

**What the receiver needs from the media.**
- **A URL the Chromecast can fetch itself.** The receiver loads `contentId`/`contentUrl` ([MediaInfo][cast-mediainfo]). A `blob:` URL only exists inside the sender's page, so it can't be sent. This follows from how object URLs work, not from a Google statement. Published receivers are on HTTPS ([cast-wr-basic]). Whether the receiver accepts plain-`http` media URLs isn't covered here (**unverified**).
- **Codecs.** Containers MP2T, MP3, MP4, OGG, WAV, WebM. Audio codecs FLAC (up to 96 kHz/24-bit), HE-AAC, LC-AAC, MP3, Opus, Vorbis, WAV ([supported media][cast-media]).
- **CORS.** "With adaptive bitrate streaming protocols, you must implement CORS." No CORS rule is given for progressive (single-file) media ([supported media][cast-media]). The streaming-protocols page only covers DASH/HLS/Smooth ([streaming protocols][cast-protocols]).
- **Live / Icecast.** Neither the supported-media page nor the protocols page mentions Icecast or endless progressive streams ([cast-media], [cast-protocols]). `StreamType.LIVE` with a null duration is the documented shape for live content ([MediaInfo][cast-mediainfo]). That an Icecast MP3 mount plays on the Default Media Receiver is **unverified** (widely done, but I found no Google statement).

## 2. Remote Playback API (`HTMLMediaElement.remote`, `disableRemotePlayback`)

**Spec.** W3C Second Screen WG, Editor's Draft dated 30 April 2024, not a Recommendation ([spec][rp-spec]). Surface: `media.remote` returns a `RemotePlayback` object with `watchAvailability(cb)`, `cancelWatchAvailability(id)`, `prompt()` (needs a user gesture), `state` (`connecting` | `connected` | `disconnected`) and `connect`/`connecting`/`disconnect` events. The `disableRemotePlayback` attribute makes the UA hide all remote UI ([spec][rp-spec]). The spec names "Miracast, Chromecast, DLNA, AirPlay, or similar" as example targets but mandates no protocol. `prompt()` may reject with `NotSupportedError` when "the media element's source is not a URL that can be passed to a remote playback device" ([spec][rp-spec]).

**Support** (from [browser-compat-data][bcd-rp], as of its 2026-11-06 main branch):

| Browser | `remote` / `RemotePlayback` | `disableRemotePlayback` | What it casts to |
|---|---|---|---|
| Chrome Android | 56 | 56 | Cast devices, by "URL flinging" ([Chromium][cr-rc]) |
| Chrome / Edge desktop | 121 | 121 | Cast devices via **media remoting** ([Chromium][cr-rp], [chromestatus][cs-rp]). Whether it lists devices for *audio-only* elements is **unverified**. |
| Safari macOS | 13.1 | 13.1 | AirPlay ([chromestatus records WebKit as shipping][cs-rp]) |
| Safari iOS | 13.1 | 13 | AirPlay |
| Firefox (desktop and Android) | No | No | n/a. Mozilla's position is listed as "Positive" ([chromestatus][cs-rp]). |
| Android WebView | No | No | n/a |

**Chromium's conditions** (read from source on `main`, Nov 2026):
- **Source scheme.** `is_source_supported` requires the URL after redirects to be `http`, `https` or `file`. On Android the codec must also be in an allow-list that includes AAC, Opus, MP3, Vorbis, FLAC and PCM. HLS is allowed too ([`media/remoting/renderer_controller.cc`][cr-rc]). A comment there reads: "Currently RemotePlayback-initiated media remoting only supports URL flinging". **So `blob:` and MediaSource sources are never castable through Remote Playback in Chromium.**
- **Duration.** Availability monitoring is turned off when `duration` is NaN or ≤ `kMinRemotingMediaDurationInSec` = 15 s ([`remote_playback.cc`][cr-rp], [`remoting_constants.h`][cr-const]). A live Icecast element reports `duration = Infinity`, so it should pass. That is an inference from the code (**unverified on device**).
- **Low-end devices.** Background availability monitoring is disabled on them ([`remote_playback.cc`][cr-rp]).
- **Errors from `prompt()`.** If the attribute is set, `watchAvailability` throws `InvalidStateError`. `prompt()` without a gesture throws `InvalidAccessError`. No devices gives `NotFoundError`. An unsupported source gives `NotSupportedError` "The currentSrc is not compatible with remote playback" ([`remote_playback.cc`][cr-rp]).

Chrome's own cast button in the native media controls is driven by the same machinery. Since M59, pages are expected to build their own button on this API ([chromestatus: remove `-internal-media-controls-cast-button`][cs-castbtn]). Neither app uses native `controls`, so neither gets the built-in button today.

## 3. Presentation API

- **Spec.** W3C Editor's Draft (12 Feb 2025), formerly a CR (2017). All interfaces are `[SecureContext]` ([spec][pres-spec]).
- **Model.** It shows a whole **web page** (a presentation URL) on a second display. In "2-UA" mode the display loads and renders the page itself; in "1-UA" mode the browser renders it and mirrors the output ([spec][pres-spec]). The spec does allow for "networked speakers capable of rendering only audio" ([spec][pres-spec]).
- **Support.** Chrome 47+ (Edge mirrors), no Safari, no Firefox ([BCD: PresentationRequest][bcd-pres]). BCD still flags it experimental.
- **Relevance for audio.** Low. To use it you'd host a receiver page that plays audio and talk to it over `PresentationConnection` messages, which amounts to a hand-built Cast receiver. The Cast Web Sender SDK packages this for Chromecast and adds a ready-made media receiver. The Cast docs note browsers have deprecated the Presentation API on insecure origins ([cast-ws]).

## 4. Safari / iOS: AirPlay

**APIs.**
- **WebKit-prefixed.** Listen for `webkitplaybacktargetavailabilitychanged` (`event.availability` is `"available"` or `"not-available"`) and call `media.webkitShowPlaybackTargetPicker()` from a click. `webkitcurrentplaybacktargetiswirelesschanged` fires when AirPlay starts or stops. Feature-detect with `window.WebKitPlaybackTargetAvailabilityEvent` ([Apple: Adding an AirPlay button to your Safari media controls][apple-airplay-btn]).
- **Standard.** `media.remote.prompt()` / `watchAvailability()` (Safari 13.1+, [BCD][bcd-rp]).
- **`x-webkit-airplay="allow"|"deny"`.** The older opt-in/out attribute. Not described on the current Apple page I could read, so its present-day effect is **unverified**. Use `disableRemotePlayback` to opt out.

**Restrictions.**
- **MediaSource.** WebKit only opens a `ManagedMediaSource` when remote playback is disabled or an AirPlay-capable alternative `<source>` (for example HLS) is present ([WebKit commit, 2023][webkit-mms]). This says WebKit can't AirPlay MSE content directly. Neither app uses MSE.
- **`blob:` sources.** For niprobin-stream: whether WebKit can AirPlay a `<audio src="blob:...">` element through the picker is **unverified**. AirPlay *video* uses URL handoff, while AirPlay *audio* can be streamed from the device, so it may work. Not tested.
- **System route.** On iPhone/iPad, Control Center → AirPlay sends "the current audio" to the chosen speakers. This needs the same Wi-Fi network ([Apple: Use AirPlay to stream audio][apple-airplay-audio]). On a Mac the Sound menu does the same. This is OS-level, so the page needs no code.

**Home Screen (standalone) web apps.**
- I found no WebKit bug or Apple statement either way on AirPlay from a standalone web app (**unverified**). Related standalone-only gaps exist. Picture-in-Picture is reported missing in Home Screen web apps ([WebKit bug 303885][wk-303885]). Wake Lock was missing until iOS 18.4 (same bug). Background-audio problems were reported in standalone mode ([WebKit bug 198277][wk-198277]).
- **Practical stance:** offer the in-page button where `WebKitPlaybackTargetAvailabilityEvent`/`remote` exists, and fall back to telling iOS users to use Control Center.

## 5. Firefox and others

- **Firefox.** No Remote Playback, no Presentation API, on desktop or Android ([BCD][bcd-rp], [BCD][bcd-pres]). Google doesn't list it as a Cast web-sender browser ([cast-ws]). There's no page-level casting path. Users can still route audio to Bluetooth or the OS output (section 6).
- **Samsung Internet.** BCD mirrors Chrome Android for Remote Playback ([BCD][bcd-rp]). Whether its backend actually lists Cast devices is **unverified**.
- **Android WebView** (and thus any app wrapping the PWA in a WebView, such as a TWA fallback): no Remote Playback ([BCD][bcd-rp]).

## 6. The OS / browser routes (no code)

| Route | Platforms | Notes | Source |
|---|---|---|---|
| Bluetooth / wired output | All | OS-level. The page's audio follows the system output. | [android-routing] |
| Android Output Switcher (system media controls → route button) | Android 11+ | Defaults to "the current device's speaker and connected Bluetooth audio devices". Cast routes appear only for apps that integrate MediaRouter/Cast. Whether Chrome adds Cast routes there for a web page's media session is **unverified**. | [android-routing] |
| Chrome desktop: Media controls → "Cast to a device" | Chrome desktop | Works for "music, a video, or other audio" playing in a tab. "The cast icon only appears when devices are available." | [chrome-gmc] |
| Chrome desktop: Cast tab (⋮ → Cast, save, and share → Cast…) | Chrome desktop | Sends the tab; "the sound only plays on your TV". Whether the menu is reachable from an installed-PWA window is **unverified**. | [chromecast-help] |
| iOS Control Center / macOS Sound menu → AirPlay | Apple | System-wide audio to AirPlay speakers | [apple-airplay-audio] |

**Media Session API.** Lock-screen/notification metadata and media keys. It has no casting function. Both apps already set `navigator.mediaSession` metadata and handlers (`src/playback/appEngine.ts`, `src/playback/htmlAudioPlayer.ts`; `body-music-vue/src/components/HeaderPlayer.vue`). That's what makes the page appear in Chrome's media controls and Android's media notification, the entry points for the routes above.

## 7. DLNA / UPnP / Sonos / HEOS

**From a normal web page or PWA: effectively impossible.**

- **Discovery.** SSDP is UDP multicast to 239.255.255.250:1900. The web has no UDP. The Direct Sockets API (TCP/UDP, Chrome 131 desktop, multicast added later) is exposed **only to Isolated Web Apps**, which are installed via enterprise policy or ChromeOS. It isn't available to ordinary installed PWAs or on Android ([chromestatus: Direct Sockets][cs-ds], [Direct Sockets multicast][cs-ds-mc]).
- **Control.** UPnP AVTransport is SOAP over plain `http://` on a LAN IP. From an HTTPS page that is mixed content.
  - Chrome 142+ puts any public-site → local-IP request behind a **Local Network Access** permission prompt. If granted, mixed-content blocking is relaxed for those requests ([chromestatus: LNA][cs-lna]).
  - Even then, the request is still subject to CORS. A SOAP call needs `Content-Type: text/xml` and a `SOAPACTION` header, which triggers a preflight that renderers don't answer. This is my reading of the Fetch CORS rules (**unverified against a real device**).
  - You'd also have to know the device's IP and control URL in advance, because discovery isn't possible.
- **Media.** The renderer fetches the file itself (a URL, not a blob). The native app solves this with an on-phone HTTP file server (`nipstream-native-app/modules/nipstream-cast/.../FileServer.kt`).
- **Sonos / HEOS / Denon.** These have their own LAN or cloud APIs. Their details are outside this research (**unverified**). Many such devices also accept AirPlay 2 or Cast. If the user's Denon amp does, the AirPlay/Cast routes above apply (**unverified for that model**).

**Server-side pattern (what does work).** The PWA tells a server "play URL X on device Y". Something **on the home LAN** then sends the UPnP SOAP `SetAVTransportURI` + `Play`. The cloud n8n at `n8n.niprobin.com` can't reach a LAN IP unless n8n runs at home or reaches it through a tunnel or VPN. Options:
1. An n8n instance or worker on the home network with an HTTP Request node posting the SOAP envelope. The controller must also feed the next track at the end of each one; the native spec's FR-10 shows this is needed ([native spec](../../../nipstream-native-app/plans/upnp-casting-spec.md)).
2. Home Assistant's DLNA/Sonos integrations driven by webhook (**unverified**, not researched).
3. Keep it native: the native Android app already discovers players, serves files and drives AVTransport (`nipstream-native-app/src/cast/`). That's the contrast: native gets raw sockets (SSDP), a local HTTP server and LAN access with no CORS. A PWA gets none of those.

---

## App-specific notes

### niprobin-stream (React/TS, desktop client)

How it plays (read from source):
- **The element.** One `new Audio()` held outside React (`src/playback/appEngine.ts`). The engine's player sets `audio.src = track.uri` (`src/playback/htmlAudioPlayer.ts`).
- **Where the URI comes from.** `track.uri` is always a **`blob:` object URL**. `src/playback/trackFiles.ts` fetches `stream_url` from `/stream` and calls `URL.createObjectURL(blob)` (ADR 0002). It does this because the file server deletes files about 10 minutes after lookup, and its CORS only allows `https://stream.niprobin.com`. In dev it's proxied as `/files-proxy` → `https://files.niprobin.com`.
- **Media Session** is already wired: metadata, play/pause/next/previous/seek.

What that means:
- **Remote Playback / Chrome's cast button / Global Media Controls cast can't work** for a `blob:` source in Chromium ([renderer_controller.cc][cr-rc]). `prompt()` will reject with `NotSupportedError`. Tab casting from Chrome desktop is unaffected because it captures the tab's output.
- **Cast Web Sender works if you send the receiver the original `stream_url`** (on `files.niprobin.com`), not the blob.
  - **CORS.** The file server's CORS allow-list shouldn't matter, since Google requires CORS only for adaptive streaming ([cast-media]). Add the receiver origin if playback fails.
  - **Codec.** Whatever format the files are (MP3/FLAC/AAC), Cast supports it ([cast-media]).
  - **Expiry is the real constraint.** The receiver streams the URL with range requests rather than keeping a full copy (**unverified**, but that's how progressive media is loaded). A long track, a long pause or a late seek can hit the ~10-minute deletion, exactly the failure ADR 0002 exists to avoid.
  - **Mitigations:** have n8n keep files longer while casting; or on a receiver load/seek error, re-run `/stream` and `loadMedia` again at `currentTime`.
- **Queue.** Keep the engine as the queue owner, as the native app does with its UPnP player (`castController.ts` swaps the `AudioPlayer`). A `CastPlayer` implementing the same `AudioPlayer` interface (`play/pause/resume/seekTo/stop`) can `loadMedia` each track and listen for the receiver's `IDLE`/`FINISHED` state to call `playbackEngine.trackEnded()`. The tab must stay open to feed the next track. Pre-loading a Cast queue doesn't fit because URLs expire.
- **AirPlay.** On Safari/macOS the OS Sound-menu AirPlay route works today (system audio). Via the in-page picker with a `blob:` source it's **unverified**.
- **DLNA (the Denon).** Not reachable from the PWA (section 7). That's the native app's job.

### body-music-vue (Vue 3 radio)

How it plays (read from source):
- **The library.** Howler with `html5: true` creates an HTML5 `Audio` node (not in the DOM) for `https://azuracast.niprobin.com/listen/body_music_radio/public.mp3?t=<now>` (`src/components/HeaderPlayer.vue`). The `/api` proxies are only for now-playing and history, not the audio.
- **Media Session** is wired: play/pause/stop and live metadata.
- **Stream headers** (`curl`, 2026-11-06): `HTTP/2 200`, `content-type: audio/mpeg`, `ice-audio-info: channels=2;samplerate=44100;bitrate=256`, `access-control-allow-origin` reflects the request origin, `cache-control: no-store`. It's served through Cloudflare + Caddy.

What that means:
- **The URL is public HTTPS MP3 with permissive CORS.** It's directly castable: by Remote Playback in Chromium (https scheme and MP3 are on the allow-list, [renderer_controller.cc][cr-rc]), by AirPlay, and by the Cast Default Media Receiver (MP3 supported, [cast-media]).
- **The `?t=` cache-buster is harmless** for casting. Generate it once per cast.
- **Getting at the element.** Howler doesn't expose its node publicly. Either read the private `howl._sounds[0]._node` (fragile), or drop Howler for a plain `HTMLAudioElement`, which removes a dependency. Howler isn't doing anything here that `<audio>` can't.
- **Unverified on device:** live streams with `duration = Infinity` passing Chromium's ≥15 s check, and the Default Media Receiver's handling of an endless Icecast MP3.

---

## Recommendation

### body-music-vue: Remote Playback button (smallest path)

1. **Own the element.** Replace Howler with one long-lived `const audio = new Audio()`. Keep the reconnect-on-play logic by setting `audio.src = streamUrl + '?t=' + Date.now()` before `play()`.
2. **Add a cast button** that only shows when a device is available:
   ```js
   if ('remote' in audio) {
     audio.remote.watchAvailability(a => (castAvailable.value = a)).catch(() => {}) // NotSupportedError on some platforms
     castButton.onclick = () => audio.remote.prompt().catch(() => {})
   } else if (window.WebKitPlaybackTargetAvailabilityEvent) {
     audio.addEventListener('webkitplaybacktargetavailabilitychanged', e => (castAvailable.value = e.availability === 'available'))
     castButton.onclick = () => audio.webkitShowPlaybackTargetPicker()
   }
   ```
   Show "connected" from `audio.remote.state` and the `connect`/`disconnect` events.
3. **Coverage.** Chromecast from Chrome Android (and Chrome desktop if remoting accepts audio-only, **unverified**), AirPlay from Safari macOS/iOS. Firefox users fall back to Bluetooth/OS routes.
4. **Optional upgrade.** If desktop Chrome doesn't list devices for the audio element, or you want artwork/now-playing on the TV, use the Cast Web Sender + Default Media Receiver instead. `MediaInfo(streamUrl, 'audio/mpeg')`, `streamType = LIVE`, `MusicTrackMediaMetadata` updated from `/api/nowplaying`. No registration needed.

### niprobin-stream: Cast Web Sender + Default Media Receiver, original URL

1. **Zero code, available today:** Chrome desktop ⋮ → Cast tab, OS Bluetooth, and the macOS Sound menu → AirPlay. Document these for the user. They cover "play on the speaker" with no work.
2. **Real Chromecast support:**
   - Load `cast_sender.js`, with `receiverApplicationId = DEFAULT_MEDIA_RECEIVER_APP_ID` and `<google-cast-launcher>` in the desktop player bar.
   - Add a `CastPlayer` implementing the engine's `AudioPlayer` interface. It `loadMedia`s the track's **`stream_url`**, so the Track Cache must expose it alongside the blob URI, plus `MusicTrackMediaMetadata` (title/artist/cover).
   - When a session starts, swap the engine's player to it (mirroring `nipstream-native-app/src/cast/castController.ts`). On `FINISHED`, call `trackEnded()`.
   - Handle the 10-minute expiry: re-lookup and reload on receiver error, or have n8n extend file lifetime for casts.
3. **Don't** try Remote Playback (the `blob:` source rules it out), the Presentation API, or DLNA from the PWA. DLNA/Denon stays in the native app. If the Denon also speaks AirPlay 2 or Cast (**unverified**), steps 1–2 reach it from the desktop too.

---

## Sources

- [cast-ws]: Google Cast, Web Sender overview: https://developers.google.com/cast/docs/web_sender
- [cast-integrate]: Google Cast, Integrate Cast SDK into your Web Sender App: https://developers.google.com/cast/docs/web_sender/integrate
- [cast-mediainfo]: Google Cast, `chrome.cast.media.MediaInfo` reference: https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.media.MediaInfo
- [cast-wr]: Google Cast, Web Receiver overview (Default / Styled / Custom): https://developers.google.com/cast/docs/web_receiver
- [cast-wr-basic]: Google Cast, Custom Web Receiver basics: https://developers.google.com/cast/docs/web_receiver/basic
- [cast-reg]: Google Cast, Registration: https://developers.google.com/cast/docs/registration
- [cast-media]: Google Cast, Supported Media: https://developers.google.com/cast/docs/media
- [cast-protocols]: Google Cast, Streaming protocols: https://developers.google.com/cast/docs/web_receiver/streaming_protocols
- [rp-spec]: W3C, Remote Playback API (Editor's Draft): https://w3c.github.io/remote-playback/
- [pres-spec]: W3C, Presentation API (Editor's Draft): https://w3c.github.io/presentation-api/
- [bcd-rp]: MDN browser-compat-data, `api/RemotePlayback.json` and `api/HTMLMediaElement.json` (`remote`, `disableRemotePlayback`): https://github.com/mdn/browser-compat-data/blob/main/api/RemotePlayback.json
- [bcd-pres]: MDN browser-compat-data, `api/PresentationRequest.json`, `api/Presentation.json`: https://github.com/mdn/browser-compat-data/blob/main/api/PresentationRequest.json
- [cs-rp]: Chrome Platform Status, Remote Playback API (Android 56, desktop 121; Safari shipped, Firefox positive): https://chromestatus.com/feature/5778318691401728
- [cs-castbtn]: Chrome Platform Status, Remove `-internal-media-controls-cast-button`: https://chromestatus.com/feature/5734009183141888
- [cr-rc]: Chromium, `media/remoting/renderer_controller.cc` (source-scheme and codec checks): https://chromium.googlesource.com/chromium/src/+/main/media/remoting/renderer_controller.cc
- [cr-rp]: Chromium, `third_party/blink/renderer/modules/remoteplayback/remote_playback.cc`: https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/remoteplayback/remote_playback.cc
- [cr-const]: Chromium, `media/base/remoting_constants.h` (`kMinRemotingMediaDurationInSec = 15`): https://chromium.googlesource.com/chromium/src/+/main/media/base/remoting_constants.h
- [cs-ds]: Chrome Platform Status, Direct Sockets API (Isolated Web Apps, desktop 131): https://chromestatus.com/feature/6398297361088512
- [cs-ds-mc]: Chrome Platform Status, Multicast support for Direct Sockets: https://chromestatus.com/feature/5073740211814400
- [cs-lna]: Chrome Platform Status, Local network access restrictions (Chrome 142): https://chromestatus.com/feature/5152728072060928
- [apple-airplay-btn]: Apple Developer, Adding an AirPlay button to your Safari media controls: https://developer.apple.com/documentation/webkitjs/adding_an_airplay_button_to_your_safari_media_controls
- [apple-airplay-audio]: Apple Support, Use AirPlay to stream audio: https://support.apple.com/105068
- [webkit-mms]: WebKit commit, ManagedMediaSource only available with an AirPlay source alternative (webkit-changes, May 2023): https://lists.webkit.org/pipermail/webkit-changes/2023-May/286989.html
- [wk-303885]: WebKit Bugzilla 303885, PiP missing in Home Screen web apps: https://bugs.webkit.org/show_bug.cgi?id=303885
- [wk-198277]: WebKit Bugzilla 198277, Audio stops when standalone web app leaves foreground: https://bugs.webkit.org/show_bug.cgi?id=198277
- [android-routing]: Android Developers, Routing between devices (Output Switcher): https://developer.android.com/media/routing
- [chrome-gmc]: Chrome Help, Cast media from Chrome (Media controls → Cast to a device): https://support.google.com/chrome/answer/9692215
- [chromecast-help]: Chromecast Help, Cast a Chrome tab on your TV: https://support.google.com/chromecast/answer/3228332

[cast-ws]: https://developers.google.com/cast/docs/web_sender
[cast-integrate]: https://developers.google.com/cast/docs/web_sender/integrate
[cast-mediainfo]: https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.media.MediaInfo
[cast-wr]: https://developers.google.com/cast/docs/web_receiver
[cast-wr-basic]: https://developers.google.com/cast/docs/web_receiver/basic
[cast-reg]: https://developers.google.com/cast/docs/registration
[cast-media]: https://developers.google.com/cast/docs/media
[cast-protocols]: https://developers.google.com/cast/docs/web_receiver/streaming_protocols
[rp-spec]: https://w3c.github.io/remote-playback/
[pres-spec]: https://w3c.github.io/presentation-api/
[bcd-rp]: https://github.com/mdn/browser-compat-data/blob/main/api/RemotePlayback.json
[bcd-pres]: https://github.com/mdn/browser-compat-data/blob/main/api/PresentationRequest.json
[cs-rp]: https://chromestatus.com/feature/5778318691401728
[cs-castbtn]: https://chromestatus.com/feature/5734009183141888
[cr-rc]: https://chromium.googlesource.com/chromium/src/+/main/media/remoting/renderer_controller.cc
[cr-rp]: https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/remoteplayback/remote_playback.cc
[cr-const]: https://chromium.googlesource.com/chromium/src/+/main/media/base/remoting_constants.h
[cs-ds]: https://chromestatus.com/feature/6398297361088512
[cs-ds-mc]: https://chromestatus.com/feature/5073740211814400
[cs-lna]: https://chromestatus.com/feature/5152728072060928
[apple-airplay-btn]: https://developer.apple.com/documentation/webkitjs/adding_an_airplay_button_to_your_safari_media_controls
[apple-airplay-audio]: https://support.apple.com/105068
[webkit-mms]: https://lists.webkit.org/pipermail/webkit-changes/2023-May/286989.html
[wk-303885]: https://bugs.webkit.org/show_bug.cgi?id=303885
[wk-198277]: https://bugs.webkit.org/show_bug.cgi?id=198277
[android-routing]: https://developer.android.com/media/routing
[chrome-gmc]: https://support.google.com/chrome/answer/9692215
[chromecast-help]: https://support.google.com/chromecast/answer/3228332
