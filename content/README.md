# Site content

Edit these files to change what the site shows. Changes go live about a minute after you commit.

- `site.json`: the menu tabs, footer links and who counts as an editor.
- `home.md`: the welcome text on Home.
- `reminders.json`: reminders on Home (maintenance, resets, what's coming next, pinned notes).
- `guides.json` and `guides/*.md`: the Guides list and each guide.
- `stamina.json`: made by `python tools/build_stamina.py`; don't edit by hand.
- `pages/*.md`: any extra pages you add as tabs.

Step-by-step instructions with examples: [guides/editing-the-site.md](guides/editing-the-site.md).

JSON tips: text goes in "double quotes", items are separated by commas, and there's no comma after the last item. If the site stops showing something after an edit, a missing or extra comma is the usual cause. You can check a file at https://jsonlint.com.
