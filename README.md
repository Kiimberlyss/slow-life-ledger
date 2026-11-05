# Slow Life Ledger

A free, fan-made tracker for **Isekai: Slow Life**. Keep your fellows, family, profile stats and event timers in one place.

- **Import a screen recording or screenshots.** The page reads names and numbers on your own device. Nothing is uploaded.
- **Event timers** count down to each event's end.
- **Tips** suggest what to upgrade next, based on your saved data.
- Your data stays in your browser. Use Back up and Restore to move it between devices.

Fellow list from the fan wiki at https://zik-ascend.github.io/isl-tools/wiki/home/. Not affiliated with the game's developers.

## Updating the fellow and family lists

The full lists (with skill slots, factions, rarity paths and family blessings) live in `data/game.json`, built from the fan wiki:

```
python tools/build_game_data.py
```

Run it after the wiki adds new fellows or family, then commit `data/game.json`.
