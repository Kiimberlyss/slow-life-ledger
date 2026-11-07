# Editing the site

Everything you'd want to change lives in the `content` folder of the GitHub repository. When you're signed in as an editor, pages show an **Edit this page** button that opens the right file on GitHub. Change it, choose **Commit changes**, and the site updates in about a minute.

## Reminders

Edit `content/reminders.json`. Each reminder looks like this:

```json
{
  "title": "Server maintenance",
  "type": "maintenance",
  "start": "2026-11-12T02:00:00Z",
  "end": "2026-11-12T05:00:00Z",
  "note": "Compensation: 300 gems."
}
```

- **type**: `maintenance`, `update` (what's coming next), `event`, `note` (pinned, no time), `daily` or `weekly`.
- **start** and **end**: UTC times, ending in `Z`. A reminder disappears by itself once it's over.
- **daily** and **weekly** use `"time": "00:00"` (UTC), and weekly also uses `"day": "Monday"`.
- **draft**: `true` hides it from everyone but editors.
- **note** can use Markdown: `**bold**`, `[links](https://…)`.

Put a comma between reminders, but not after the last one.

## Guides

1. Add a Markdown file to `content/guides/`, like `content/guides/family-tips.md`.
2. Add it to `content/guides.json` with a `slug` (its address), `title`, `summary` and `file`.

## Tabs

The menu is `content/site.json`. To add a page of your own, write a Markdown file (say `content/pages/collabs.md`) and add a tab:

```json
{ "id": "collabs", "label": "Collabs", "icon": "heart", "type": "page", "file": "content/pages/collabs.md" }
```

Reorder the tabs by reordering the lines. Icons: home, bolt, book, wiki, user, bell, sprout, heart, sword, cal, bulb.

## Stamina tables

The Stamina page comes from `content/stamina.json`, made from the community spreadsheet. To refresh it after the sheet changes, run this from the repository folder and commit the result:

```
python tools/build_stamina.py
```

## Fellow and family wiki

The Wiki uses `data/game.json`, made from the fan wiki. To refresh it, run `python tools/build_game_data.py` and commit the result.
