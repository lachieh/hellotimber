export const CALL_SERVICE_KNOWN_GAPS: Readonly<Record<string, string>> = {
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
