# Auto, on your own initiative

Auto can now speak first. Each morning it prepares a brief for you, it suggests work worth starting,
it shows you exactly what it is about to do before you approve it, and it tells you what it depends
on. This page covers how each of those looks on the phone.

You do not switch any of this on in the app. Each feature appears only when your Automatos server
offers it (see [What shows only when the server offers it](#what-shows-only-when-the-server-offers-it)).

## The daily brief

Once a day, the first time you open the app, Auto prepares your brief and posts it in your
conversation with Auto. The app asks once per day for each workspace. If you open the app on two
phones, you get one brief, not two.

The brief shows:

- the date and Auto's greeting;
- **Auto's Read**, a short summary in its own words;
- sections, in this order: **Needs you**, **Ideas**, **Today**, **Since your last brief** and
  **Couldn't check**. A section with nothing in it is left out. A section with more than six rows
  shows five and a **Show N more** button;
- a line saying "Nothing new needs you, and nothing is scheduled today." when every section is
  empty.

Each row has a title and a line saying why it is there. Where a row goes somewhere, it has an
action in words, such as **Start →** or **Answer →**. A row opens the Task, Mission, question,
conversation or Deliverable it names. If the phone has no screen for it, it opens in Studio in your
browser, and VoiceOver says so.

When the brief opens, the conversation with Auto scrolls to it, so the first thing you see is today's
brief rather than the end of last night's chat. This happens on the home screen in Studio, Play and
Candy, which show the conversation. In HUD and Arcade the brief is already in front of you.

### Where it appears

| Layout | The brief |
|---|---|
| Studio | A box from Auto in the conversation. While it is on screen, the "needs you" strip above the composer shrinks to its count, so the same items are not listed twice. |
| Play | A card at the head of the day in the conversation. |
| Candy | The brief fills Auto's bubble in the Chat view, in place of the plain words. |
| HUD | The brief fills the transcript area while it is the newest message. **OPEN BRIEF** opens its numbered rows in a sheet. |
| Arcade | The dialogue says the greeting and Auto's Read. **OPEN BRIEF**, beside TYPE, opens the brief in a sheet. |

In HUD, the rows that ask something of you (Needs you, then Ideas) are numbered, so you can say
"start two".

### Listen

**Listen** reads the brief aloud. It never starts by itself; it plays only when you press it, and
the same button becomes **Stop**. It reads the brief's own spoken version, which uses the row
titles only (the screen shows the reasons). If your server has a voice for Auto and you use it,
Auto's server voice reads. If the server refuses part-way, the phone's own voice reads the rest. An
AI label sits beside the button, since the voice is an AI's.

### Thumbs

Under Auto's Read, a thumbs up and thumbs down say whether the brief was useful. The one you pressed
fills in. Pressing it again sends nothing. If it cannot be saved you see one line and your last
choice returns. The thumbs are shown only when you can use Auto in this workspace; a viewer does not
see them.

### Start on a row

A row in **Ideas** has **Start**. It starts the suggestion exactly as Start does anywhere else (see
below), including Face ID, and the row then says "Started" in place of the action.

## Suggestions

Auto looks for work worth doing and proposes it. A suggestion has a title, a short reason, and a line
saying what **Start** will do:

- file a Task on the Board for it;
- plan a Mission for it (you approve the plan first);
- run a Playbook;
- open a conversation with Auto about it.

### Where they appear

| Layout | Newest suggestion | All of them |
|---|---|---|
| Studio, Play, Candy | A card pinned directly above the message box. With the keyboard up it is one line, labelled "Idea". | **Ideas · N** in the header opens a sheet of every open suggestion. In Candy it is in the Today header. |
| HUD | A **NEXT** line with **START** and **HIDE**. | **IDEAS · N** in the command row. |
| Arcade | A **NEXT** line under the status bar, with **START** and **HIDE**. | **IDEAS · N** under the status bar. |

Nothing is shown when no suggestion is open.

### Start and Hide

- **Start** asks for Face ID first, because it starts work. After it goes through, the card says
  "Started. Auto is on it." for four seconds. Only owners, admins and editors can start.
- **Hide** asks why: **Not now**, **Not useful** or **Wrong agent**. Choosing **Cancel** hides
  nothing. Hide never asks for Face ID.
- If Start is refused, one line says why and the suggestion stays: you are offline; it expired; it
  was already started or hidden; that kind cannot be started from the phone yet (open it in
  Studio); or Auto cannot start new work right now (ask your workspace owner).

### In the conversation

When Auto posts a suggestion in your conversation, it appears there as a card while it is still open
and is not the one already pinned. After you Start from it, it shows "Started. Auto is on it." for
four seconds. When it is decided or expired, only Auto's words remain.

### On the Board

The Board has a **From suggestions** filter. It lists the Tasks that a suggestion's Start filed,
whatever their status.

## Approvals

When Auto wants to run a tool or carry out a plan that needs your say-so, you see an **approval
sheet** that shows, before any button:

- who asked and how long it is waiting ("Waiting · 4 min left");
- the action, and what it acts on (for example a list and a mailbox);
- the exact content, as plain text you can select (for a send, "What it will send");
- the rule that made it ask.

Then two buttons:

- **Approve & run**, which asks for Face ID first. Once the approval has expired it is not offered.
- **Deny** on a tool, or **Reject** on a plan (a plan asks for your reason). These never ask for Face
  ID.

The conversation's card stays as the record of what you decided. "Always allow" is offered only if
the server offers it, and then it sends you to Studio's governance page, where rules are set.

You reach the sheet in two ways:

- **From the app.** Tap the approval's card in the conversation. In HUD, which has no cards, the
  sheet opens by itself for the newest approval waiting; if you close it, a line under the state
  chip, **WAITING FOR YOU · OPEN**, brings it back.
- **From a notification.** Tapping the notification opens the app as before, and the sheet opens over
  it. This works only if your server offers it and your role may approve. If someone has already
  decided it, or it has lapsed, you see one line saying so instead.

## What Auto depends on

**Settings → What Auto depends on** lists what Auto needs to do its work, and says which of these
are ready. Each row has the item, a short detail, and its state as a glyph and a word. Some rows
come from your server and some from this phone: notifications, the microphone, speech recognition
and Auto's server voice. A row with something you can fix on the phone has a button that opens the
right screen. The phone never sends you to a web page from here.

**Check again** asks the server to check every item now. It can be used only so often; if you press
it too soon, a line says so and nothing is checked.

## Status words and glyphs

Wherever the app shows the state of work, it uses one set of words and marks, and never colour
alone.

| Glyph | Meaning | Words |
|---|---|---|
| ◆ | A person must act | Needs you, Needs setup |
| ● | In motion | Working |
| ✓ | Finished or fine | Ready to look at, Done, Ready |
| ○ | Waiting, or not known | Not checked, queued |
| ✕ | Failed | Couldn't finish |
| — | Stopped | Paused, cancelled, idle |

Studio and Play say "Ready to look at" for finished work you have not opened yet. HUD, Arcade and
Candy draw the same glyphs with shorter words (READY, FAILED in HUD).

On Board cards, the ticket sheet and Questions, a row also shows its **next step** on a line starting
with ▸ ("Allow me to send it, or refuse."), and a failed row offers **Try again**. Try again runs the
Task again, re-runs a failed Mission's failed steps, or plans them anew, depending on the failure. It
asks for Face ID first, as it starts work.

## What shows only when the server offers it

The app checks what your server can do and shows a feature only when the server lists it. An older
server shows none of the new things, and nothing else changes.

| You see | When the server offers |
|---|---|
| The brief, its Listen and thumbs, and Start on a row | the brief |
| The pinned suggestion, **Ideas · N**, the thread card and **From suggestions** | suggestions |
| **What Auto depends on** in Settings | readiness |
| The approval sheet from a notification | approval views |
| Auto's server voice for Listen | a voice for Auto |

The status words, next step and Try again have no switch of their own: they appear on any row whose
server answer carries them.

## What is off by default

- **Listen** never plays by itself.
- **Always allow** is not offered unless the server sends it.
- Face ID is asked before Start, Try again and Approve & run. It is never asked for Hide, Deny or
  Reject.
- The phone has no setting that turns these features on. The server decides, so a server that has
  not turned proactive features on shows none of them.
