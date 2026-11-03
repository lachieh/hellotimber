# @hellotimber/phone-services

The shared state of a GSM handset, without screens or menus: the SMS store and messaging
service, the chat session, the phone book, the SIM card and its messages and toolkit data, the
telephone and the call log, and the network port. It has no dependencies, not even on
phone-core. It reaches the outside world through ports: `storage` (the Web Storage subset, so
`window.localStorage` fits), the `network` port and a `settings` reader.

`@hellotimber/nokia-kit`'s apps and `@hellotimber/nokia-os`'s v6.39 firmware share one instance of
these services; a host (the website's emulator controls) drives the same instance.

## Usage

Modules are imported by path (`"exports": { "./*": "./src/*.ts" }`, TypeScript source, no build):

```ts
import { dialOutcome } from "@hellotimber/phone-services/calls/dial-string";
import { createSyntheticNetwork } from "@hellotimber/phone-services/messaging/network";
import { createMemoryStorage } from "@hellotimber/phone-services/storage";

const storage = createMemoryStorage(); // or window.localStorage
const network = createSyntheticNetwork(); // every send is "sent"; deliver() injects an SMS

network.dial(
  { number: "0412345678", emergency: false },
  {
    alerting: () => console.log("alerting"),
    connected: () => console.log("connected"),
    released: () => console.log("released"),
  },
);
console.log(dialOutcome("112")); // how the handset treats a dialled string
```

## Tests

`vp run @hellotimber/phone-services#test`.
