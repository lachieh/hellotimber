# Extra games (plan 28, not stock)

This is planned behaviour being built by plan 28, not captured firmware ground truth.

Hosts opt in through `StockPhoneConfig.games`. Extra games appear after Pairs II in the
order supplied. Snake II through Pairs II keep 8-1 through 8-4; extras take 8-5 onward.
Settings stays at 8-6 with zero or one extra game, then takes 8-(5+n) for n ≥ 2.
Slugs, including `menu/games/settings`, stay unchanged. Without extras the stock menu stays unchanged.

A failed game shows the composed `Game\nerror` note (two lines). This text and extra-game
gameplay have no captured ground truth. The surrounding shell reuses stock widgets; gameplay
replay goldens are project snapshots rather than evidence of Nokia firmware behaviour.
