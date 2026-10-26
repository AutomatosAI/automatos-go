# Age rating: App Store and Google Play (OT-R13)

Automatos Go is for people aged 16 and over: one minimum age [D12], in the store metadata, the
privacy policy, the Terms draft and the app. Requirements R16 and R22 and owner step OT-R13 are in
[README.md](README.md). This page gives the answers to Apple's age-rating questionnaire and to
Play's IARC questionnaire, each with its reason, and how each store ends at 16+.

Proof: [src/release/\_\_tests\_\_/release-docs.test.ts](../../src/release/__tests__/release-docs.test.ts)
reads every document in `docs/release`. Every minimum age they state is 16, except the two places
that quote the live Terms' 18 (below) and Play's age-group names. Each of those is an ALLOWED entry
with its reason.

This machine cannot open App Store Connect or Play Console (KR14), and the questionnaires' exact
wording was not read here. Match each answer below to its question by topic. If a form asks
something this page does not cover, answer it from "What the app does" and add the answer here.

## What the app does (the facts every answer rests on)

- **An AI assistant that writes text.** Auto, and any agent in the workspace, replies to what the
  person asks. The models are those of the providers the connected server lists (`ai_providers`,
  named on the consent sheet; Retell AI among them when the workspace can use Auto Live). On an own
  server they are whatever its operator chose. The app adds no content of its own beyond its
  labels.
- **Report this** is on every saved Auto reply and on every Deliverable, in every style
  (`src/release/__tests__/surfaces.test.ts`, [privacy-facts.md](privacy-facts.md) "Report this").
- **No WebView and no in-app browser** [D3, D32]. Links, Studio pages and the legal pages open in
  the system browser, outside the app. Deliverable files open in the phone's own viewer.
  `src/release/__tests__/dependency-audit.test.ts` denies `react-native-webview`.
- **No person-to-person chat.** Conversations are with Auto and the workspace's agents. Members of a
  workspace see each other's tickets, answers and approvals. Only its owner, in Studio, decides who
  is a member.
- **No advertising, no purchases, no gambling or contests, no location** (R11, R13;
  [android-permissions.json](android-permissions.json) denies location).
- **No parental controls and no age check in the app.** Accounts are made in Studio by invitation
  [D5, D64]. The minimum age is in the Terms and the privacy policy (section 14).

## Apple: the App Store Connect questionnaire

Apple's tiers are 4+, 9+, 13+, 16+ and 18+ (since July 2025). App Store Connect works out a rating
from the answers. If that rating is under 16+, choose 16+ with App Store Connect's option to set a
higher rating than the answers give [D12]. If it works out higher than 16+, stop and ask Gerard:
the answers below are not meant to give 18+.

| Topic | Answer | Reason |
|---|---|---|
| Parental controls | No | The app has none. |
| Age assurance | No | The app checks no age. Accounts are made in Studio by a workspace owner's invitation. The minimum age is in the Terms. |
| Unrestricted web access | No | No WebView and no in-app browser. A link opens in Safari, outside the app, under Safari's own restrictions. |
| User-generated content | No `[CHECK]` | Nothing is published to strangers. The words of other people in the app come from members of the same workspace, whom its owner invited. Auto's output is answered under the AI rows below, and it has Report this. If Gerard reads workspace content as user-generated content, answer Yes: Report this covers Auto's replies and Deliverables, not a colleague's ticket. |
| Messaging and chat | Yes | The main screen is a chat, with Auto, an AI assistant. There is no chat between people. |
| An AI assistant or chatbot (if asked) | Yes | Auto. "Auto is an AI" opens every conversation [D73], and Report this is on every reply [D15]. |
| Advertising | No | No advertising SDK (R11, `dependency-audit.test.ts`). |
| Profanity or crude humour | Infrequent/Mild | The app has none of its own. Auto writes what a person asks for, and an AI assistant can repeat mild language when asked. |
| Mature or suggestive themes | Infrequent/Mild | Same reason: an AI assistant can discuss adult subjects in text when asked. |
| Horror or fear themes | Infrequent/Mild | Same reason. |
| Alcohol, tobacco or drug use or references | Infrequent/Mild | Same reason: Auto can talk about them in text, as it can about any subject. |
| Medical or treatment information | Infrequent/Mild | Auto is a work assistant, not a health app, but it can answer a health question. It gives no treatment and claims no medical use. |
| Health or wellness topics | No | The app is not about health. |
| Sexual content or nudity | None | The hosted providers' usage policies refuse explicit content, and the app adds none. `[CHECK]`: on an own server the operator chooses the models; the 16+ minimum, the Terms and Report this (to the operator) cover that. |
| Graphic sexual content and nudity | None | Same reason. |
| Cartoon or fantasy violence | None | The app has none. |
| Realistic violence | Infrequent/Mild | Auto can describe a news event or a scene in text when asked. Nothing is graphic. |
| Prolonged graphic or sadistic realistic violence | None | The hosted providers' policies refuse it. |
| Guns or other weapons | None | The app has none, and it sells nothing. |
| Simulated gambling | None | None in the app. |
| Gambling | No | None in the app. |
| Contests | No | None in the app. |
| Loot boxes | No | None in the app. |

## Google Play: the IARC questionnaire (for later, D10)

Play Console → App content → Content rating, when a console exists.

| Question | Answer | Reason |
|---|---|---|
| Category | Utility, productivity, communication or other | A workspace and assistant app, not a game. |
| Violence, fear, sexuality, gambling, controlled substances | No | The app contains none of its own. Auto's replies are covered by the interactive rows below. |
| Language (crude humour, profanity) | No | Same reason. |
| Users can interact or exchange content | Yes | People in a workspace see each other's tickets, answers and approvals, and every person chats with Auto. |
| Content generated by AI (if asked) | Yes | Auto's replies, labelled "Auto is an AI", with Report this in the app (Google's generative-AI policy asks for reporting inside the app [D15]). |
| Shares the user's location | No | The app asks for no location, and photos leave without it (R09). |
| Digital purchases | No | The app sells nothing [D8]. |
| Unrestricted internet access | No | No WebView; links open in the system browser. |

IARC gives each region its own rating from these answers. The answers do not set a minimum age, and
the rating may come out lower than 16. On Play the minimum age comes from **App content → Target
audience and content**: tick only the age groups 16–17 and 18 and over, and answer that the app is
not designed to appeal to children. The minimum age then matches the Terms and the policy.

## The Terms' 18 against D12's 16 (Gerard's conflict)

The live Terms at https://automatos.app/terms (v2.3, section 02) say "You must be at least 18". D12
says 16.
The app, this page, the listing's description, the privacy policy draft (section 14) and the Terms
draft (section 02) all say 16. Until the live Terms say 16, the store answers and the Terms
disagree. This wave never edits the Terms (KR11).

Gerard chooses one of two ways:

- **16 (D12):** publish the Terms draft's section 02 with the 30 Oct drop (OT-R3). Nothing here
  changes.
- **Keep the Terms' age:** then the app's minimum age moves with it, and these change together:
  this page, the listing's description, `MINIMUM_AGE` in
  `src/release/__tests__/support/forbidden-copy.ts`, the privacy policy's section 14, and the store
  answers (Apple's higher rating, Play's target audience).

## Owner step (OT-R13)

1. Resolve the Terms' 18 against D12's 16 before the first submission.
2. In App Store Connect → App Information → Age Rating, answer the questionnaire from the Apple
   table. If the result is under 16+, choose 16+. Record the result here.
3. When a Play Console exists, answer IARC from the Play table and the target audience as above.
