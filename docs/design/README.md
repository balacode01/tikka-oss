A calm, compact tool for planning and tracking work. Screens are neutral grey and white; colour appears only where it means something: a status, an issue type, a destructive action or the one main button on the page.

## Voice and copy

- Write in sentence case everywhere: buttons, headings, tabs, menu items. "Create issue", not "Create Issue".
- Start buttons with a verb and keep them to one to three words: "Create issue", "Start sprint", "Complete sprint", "Add comment".
- Speak to the user as "you" and call their things "your": "Your work", "Your projects". The product never says "I".
- Skip "please", "successfully" and exclamation marks. A confirmation is past tense: "Issue created", "Sprint started".
- Errors say what happened, then what to do: "That key is already in use. Try another."
- Empty states invite an action: "Create your first issue", with one line explaining the space and one button.
- Write issue keys exactly as stored, in the `key` style: TM-142.

## Colour

- Build every screen from `surface-page`, `surface-raised`, `border`, `text-primary` and `text-secondary`. Reach for a colour token only when it carries meaning.
- Use `primary` for one filled button per view (Create issue on the board, Start sprint in the backlog), for links, the focus ring and the selected tab underline. Put `on-primary` text on it. Other buttons are outlined: `surface-raised` with a `border-strong` edge and `text-primary` label.
- Never use `primary` to show a status, a type or a priority.
- Hover is `surface-hover`. Selected rows, the active sidebar item and drop zones are `surface-selected`, with `text-primary` or `primary-subtle-text` on top.
- Board columns are `surface-hover`; the cards inside them are `surface-raised` with a `border` edge.

### Status

- Every status belongs to one of three categories. To do uses the `status-todo` family, In progress uses `status-progress`, Done uses `status-done`. A custom status such as "In review" takes its category's colours.
- A status pill is `status-*-bg` with `status-*-text`, `radius-full`, `caption` or `meta` text. A status dot or icon is `status-*`.
- Never show a status by colour alone. The pill always carries the status name, and a dot always sits beside the column name.

### Issue types

- Show the type as a 16px icon in its colour: Epic `type-epic`, Story `type-story`, Task `type-task`, Bug `type-bug`, Sub-task `type-subtask`.
- Type colours are for icons only. Never fill a card, row or column with them.

### Priority

- Show priority as a signal-bars icon in `text-secondary`: Low, Medium, High.
- Only Urgent gets colour: a `danger` alert icon. That keeps the board from turning into a rainbow.

### Danger

- Use a `danger` fill with `on-danger` text for destructive confirmations such as "Delete issue". Ask first in a modal.
- Inline errors are `danger-text` on `danger-bg`. An invalid field gets a `danger` edge and its message under it in `caption`.

## Type

- Set all interface text in Montserrat (`sans`). Set issue keys, branch names and code in JetBrains Mono (`mono`). Load both from Google Fonts: Montserrat 400, 500 and 600; JetBrains Mono 400 and 500.
- Montserrat's letters are wide. Keep card titles to two lines, cut the rest with an ellipsis and show the full title on hover. Keep button and tab labels to one to three words.
- In Montserrat a capital I and a lowercase l look the same. Put anything people read character by character, such as issue keys, branch names and codes, in `mono`.
- `body` (14px) is the default for card titles, form values, menus and rows.
- `meta` (13px) for card metadata, table cells and sidebar items. `caption` (12px) for timestamps, helper text and column counts.
- `label` (14px, 500) for buttons, field labels, tabs and the active sidebar item.
- `description` (16px) for issue descriptions and comments, where people read longer passages.
- `page-title` (20px) for page and modal titles; `issue-title` (24px) only for the issue title on the detail page and side panel.
- Use three weights: 400 for text, 500 for controls and emphasis, 600 only in the two title styles.
- Show counts, story points and dates with `font-variant-numeric: tabular-nums` so columns of numbers line up.

## Spacing and layout

- Space on a 4px grid with `space-1` to `space-12`. Card padding is `space-3`, the gap between cards is `space-2`, the gap between board columns is `space-4`, page padding is `space-6` and the gap between page sections is `space-8`.
- The app frame is a sidebar of `sidebar-width` that collapses to `sidebar-width-collapsed`, plus a top bar of `topbar-height` with search, the Create issue button and the avatar menu.
- Board columns are `column-width` wide and scroll sideways when they don't fit. The issue side panel is `panel-width` and slides in from the right.
- Controls are `control-height` (32px) tall. The density is compact: fit as many cards on screen as stays readable.

## Shape and depth

- `radius-sm` for buttons, inputs, tags and menu items. `radius-md` for cards, board columns and menus. `radius-lg` for modals and the side panel. `radius-full` for pills, avatars and count badges.
- Separate surfaces with 1px `border`, not shadows.
- Use `shadow-popover` only for menus, dropdowns, tooltips and the command palette. Use `shadow-modal` only for modals and a card while it is being dragged.

## States and interaction

- Every focusable element shows a 2px `primary` outline with a 2px offset when focused from the keyboard. It meets 3:1 on every surface in both themes.
- Avoid disabled buttons. Keep the button enabled and explain what's missing when it's pressed. Where a control truly can't be used, show it in `text-secondary` on `surface-hover`.
- While dragging a card, lift it with `shadow-modal` and show the drop position as a `surface-selected` gap with a dashed `primary` edge.
- Keyboard shortcuts: Ctrl or Cmd+K opens quick search, C creates an issue. Show shortcuts in menus as `caption` text in `text-secondary`.

## Iconography

- Use Lucide outline icons at their default 2px stroke: 16px inside cards, rows and buttons; 20px in the sidebar and top bar. Icons take the colour of the text beside them unless a token above says otherwise.
- Issue types: Epic `zap`, Story `bookmark`, Task `square-check`, Bug `bug`, Sub-task `corner-down-right`. Priority: `signal-low`, `signal-medium`, `signal-high`, and `circle-alert` for Urgent.
- No emoji in the interface. Icons are not stored in this system: install the Lucide package for your frontend.

## Themes and accessibility

- Ship Light, Dark and "Match system". Switch themes by setting `data-theme="light"` or `data-theme="dark"` on the root element; every token above has a value in both.
- Text pairs named in each token's usage note meet 4.5:1 in both themes. Icons, control edges and the focus ring meet 3:1.
- Status, type and priority always come with a word or a distinct icon, so nothing depends on telling colours apart.
