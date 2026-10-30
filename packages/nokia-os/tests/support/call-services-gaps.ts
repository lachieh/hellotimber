export const CALL_SERVICE_KNOWN_GAPS: Readonly<Record<string, string>> = {
  "calls-services/identity-persist-identity-2":
    "Dialled digits and Calling pixels match; the test cell's common connection times differ after 8303 ms. The recording erases Calling before its alert/connect transition and connects later; caller-identity metadata itself is passed to the host without inventing new remote progress.",
  "calls-services/persist-reboot":
    "This cold reboot records a 974 ms fully-set LCD self-test, followed by a 1191 ms blank and Nokia frame. The shared boot timeline uses the foundation power-key self-test/blank timing instead; pixels and offsets differ before the final security gate. The recording never reaches standby and does not prove divert persistence.",
  "calls-services/in-call-ack-hold":
    "The explicit test host acknowledges Hold synchronously; the captured cell updates the held icon 1497 ms after Select. The subsequent 123 digits/Options redraw and retained held icon differ; no local network acknowledgment delay is invented.",
  "calls-services/in-call-ack-new-call":
    "New call opens the pixel-exact inherited prompt and dials through the host, but the later typed-number cursor phase differs near 5284 ms and later Calling/connection redraws still differ while the first call is held. Independent two-call lifecycle remains capture-blocked in 22c.",
  "calls-services/in-call-ack-send-dtmf":
    "The inherited DTMF opening is pixel-exact and the host receives 123, but later number-entry cursor/key redraws differ after 4081 ms. Sending completion follows the transmitted-tone program; the capture's three-digit transmission ends near 6980 ms after Select, with intermediate firmware progress frames not yet reproduced.",
  "calls-services/in-call-ack-pause":
    "The host receives post-connect 123 after the captured 2500 ms pause, but the Calling and connection redraws differ (first at 2077 ms), and the Sending/bar return timeline is not yet pixel-exact. No host transmission success is inferred when its operation is absent or pending.",
  "calls-services/in-call-ack-wait":
    "The phone waits for Send before giving post-connect 123 to the host, but its waiting digits omit the captured lower box border at 3020 ms. The subsequent Sending/bar completion frames differ; network success still requires an explicit host outcome.",
  "calls-services/none-divert-cancel":
    "The common unanswered timeout is 14867 ms; this recording retains its final progress-bar frame from 14896 to 14931 ms (35 ms). That settled bar frame is omitted before Not done; the error screen itself matches.",
  "calls-services/none-divert-mailbox":
    "The common unanswered timeout is 14867 ms; this recording retains its final progress-bar frame from 14892 to 14953 ms (61 ms). That settled bar frame is omitted before Not done; the error screen itself matches.",
  "calls-services/none-divert-all-cancel":
    "The common unanswered timeout is 14867 ms; this recording retains its final progress-bar frame from 14891 to 14926 ms (35 ms). That settled bar frame is omitted before Not done; the error screen itself matches.",
  "calls-services/none-waiting-activate":
    "The common unanswered timeout is 14867 ms; this recording retains its final progress-bar frame from 14894 to 14970 ms (76 ms). That settled bar frame is omitted before Not done; the error screen itself matches.",
  "calls-services/none-waiting-status":
    "The common unanswered timeout is 14867 ms; this recording retains its final progress-bar frame from 14895 to 14931 ms (36 ms). That settled bar frame is omitted before Not done; the error screen itself matches.",
  "calls-services/none-string-1":
    "The common unanswered timeout is 14867 ms; this recording retains its final progress-bar frame from 14938 to 14989 ms (51 ms). That settled bar frame is omitted before Not done; the error screen itself matches.",
  "calls-services/none-string-3":
    "The common unanswered timeout is 14867 ms; this recording retains its final progress-bar frame from 14921 to 15028 ms (107 ms). The bar frame and error onset differ; no per-path timeout or tolerance has been introduced.",
  "calls-services/none-string-4":
    "The common unanswered timeout is 14867 ms; this recording retains its final progress-bar frame from 14921 to 14956 ms (35 ms). That settled bar frame is omitted before Not done; the error screen itself matches.",
  "calls-services/verified-ok-string-2":
    "After the captured Not done response to *123#, the emulator loses network registration: the signal ladder changes at 6358 ms and the operator disappears at 16358 ms. StockNetworkPort has no registration-status event; the service response matches but those later standby states are absent.",
  "calls-services/verified-error-string-2":
    "After the captured Not done response to *123#, the emulator loses network registration: the signal ladder changes at 6358 ms and the operator disappears at 16358 ms. StockNetworkPort has no registration-status event; the service response matches but those later standby states are absent.",
  "calls-services/verified-error-string-4":
    "After the captured Not done response to ##002#, the emulator loses network registration: the signal ladder changes at 5738 ms and the operator disappears at 15738 ms. StockNetworkPort has no registration-status event; the service response matches but those later standby states are absent.",
};
