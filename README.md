# Slow Life Ledger

A free, fan-made companion for **Isekai: Slow Life**: https://kiimberlyss.github.io/slow-life-ledger/

- **Home**: reminders for maintenance, resets and what's coming next.
- **Stamina**: milestone, gem pack and "ways to get a UR" tables for every stamina event, from the community stamina spreadsheet.
- **Guides**: Markdown write-ups.
- **Wiki**: every fellow and family member, with skills and who blesses whom, from the [fan wiki](https://zik-ascend.github.io/isl-tools/wiki/).
- **My ledger**: your own profile (with earnings-to-power ratio and a picture), fellows, family, event timers and tips. Saved in the browser, or to your Google account when signed in.

Not affiliated with the game's developers.

## Editing content

Everything people read lives in [`content/`](content/README.md) as plain JSON and Markdown files. No code changes needed:

| To change | Edit |
|---|---|
| Menu tabs, links, editors | `content/site.json` |
| Reminders | `content/reminders.json` |
| Home welcome text | `content/home.md` |
| Guides | `content/guides.json` and `content/guides/*.md` |
| A page of your own | a Markdown file plus a `"type": "page"` tab in `content/site.json` |

Signed-in editors (listed in `content/site.json`) see **Edit this page** buttons that open the file on GitHub. The full how-to is in [`content/guides/editing-the-site.md`](content/guides/editing-the-site.md).

## Refreshing data

```
python tools/build_stamina.py      # content/stamina.json, from the stamina spreadsheet
python tools/build_game_data.py    # data/game.json, from the fan wiki
```

Commit the file each one writes.

## Code layout

| Folder | What's in it |
|---|---|
| `index.html` | The page layout |
| `css/style.css` | Base look: colours, banner, cards, the ledger |
| `css/pages.css` | Home, Stamina, Guides, Wiki and profile |
| `js/` | Scripts, loaded in the order listed at the bottom of `index.html` |
| `content/` | Everything editable |
| `data/game.json` | Fellow and family reference data |
| `tools/` | Scripts that rebuild the data files |
| `firestore.rules` | Who can read and write saved ledgers |
