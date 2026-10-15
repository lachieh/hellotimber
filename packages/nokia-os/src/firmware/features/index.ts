// Every stock feature, one line each (`src/firmware/stock.ts` composes them): a plan adds a
// feature as `features/<slug>.ts` exporting a `StockFeature` and one `export` line here, or
// extends the feature of the menu area it implements. Nothing else may be exported here.
export { backlightFeature } from "./backlight";
export { callDivertFeature } from "./call-divert";
export { callRegisterFeature } from "./call-register";
export { calculatorFeature } from "./calculator";
export { chatFeature } from "./chat";
export { clockFeature } from "./clock";
export { composerFeature } from "./composer";
export { gamesFeature } from "./games";
export { keyguardFeature } from "./keyguard";
export { snakeFeature } from "./games-snake";
export { languagesFeature } from "./languages";
export { messagesFeature } from "./messages";
export { noteStylesFeature } from "./note-styles";
export { phoneBookFeature } from "./phone-book";
export { profilesFeature } from "./profiles";
export { remindersFeature } from "./reminders";
export { securityFeature } from "./security";
export { settingsFeature } from "./settings";
export { tonesFeature } from "./tones";
