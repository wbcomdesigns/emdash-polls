# Troubleshooting

**Included in Free.** WB Polls has no paid version.

## The poll does not show on my page

Check these in order:

1. **Is the poll open?** On the Polls screen its status must be **Open** or **Closed**. Drafts and scheduled polls stay hidden.
2. **Is it attached to this page?** **Where it shows** must be the whole site, this page's content type, or this page itself. **Not attached** shows nowhere.
3. **Does the template have a slot?** Your developer adds `<PollSlot ... />` to the post and page templates. Without it no poll appears. See [Install](../getting-started/install.md).
4. **Two slots with positions?** A slot marked `position="above"` only shows polls set to **Above the content**, and the same for below.
5. **Another poll wins?** A poll attached to this one page hides the one for all posts. Open the post's editor; the **Poll** panel says which poll visitors see.

## Voting stopped after I updated the plugin

Copy the site kit again from the version you installed. The kit and the plugin are released together.

## "This site cannot record a guest vote right now."

The visitor's browser blocked the small code WB Polls uses to remember a guest vote, and your hosting did not pass on the visitor's address. Ask the visitor to allow site data for your site, or set the poll to **Signed-in members only**.

## "You have already voted."

That visitor's vote is already counted. On a poll with **Members may change their vote while the poll is open**, a signed-in member sees **Change vote** instead.

## "Too many requests. Try again in an hour."

The same visitor sent a lot of votes in a short time. WB Polls slows this down to keep results fair. It clears by itself.

## Members get "Sign in to vote in this poll."

The poll is set to **Signed-in members only**. Members need an account on your site. Turn on sign-up in EmDash if visitors cannot create one.

## The poll looks plain or the colours are wrong

The kit's two style files must be copied: `src/styles/polls.css` and `src/styles/wbcom-base.css`. If they are there, your theme may not define a brand colour; see [Wording and look](../customize/wording-and-look.md).

## No poll list in the post editor's Poll panel

**Use an existing poll** lists polls that are not already attached to this page. Create a poll first on the Polls screen, or use the form in the panel.
