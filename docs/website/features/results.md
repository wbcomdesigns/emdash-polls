# Results and voters

**Included in Free.** WB Polls has no paid version.

## In admin

On the **Polls** screen, choose **Actions** on a poll, then **Results**.

![The Results screen with total votes, answer count, status and a table of answers](../images/admin-results.webp)

You see:

- **Votes**, **Answers** and **Status** at the top.
- A bar chart of the answers. A long answer is shortened on the chart. The table below keeps the full wording.
- A table with each answer's votes and share.
- **Recount votes** at the bottom, which counts the poll's votes again from the stored votes. Use it if a total ever looks wrong. It counts a few answers at a time: while it runs, the screen says how many answers are counted and has **Continue counting**, and visitors see "Results are being counted" instead of numbers.

### Polls from before 0.5.0

WB Polls 0.5.0 keeps a running total for each poll, so a page shows results in one step. A poll created before 0.5.0 gets its total the first time someone opens it, on your site or in the admin. A poll with up to 100 votes is counted at once. A bigger poll is counted over two or three page views, and until then shows "Results are being counted" (on your site) or **Counting** (in the admin) instead of a number that is not finished yet.

### Named polls

If **Show each member's choice to the site owner** is on, the Results screen also lists each signed-in member and what they chose, 25 at a time. Guests are never named, even on a named poll.

Each member row has **Remove votes**, which removes that member's votes from this poll. Use it when a member asks you to remove their data. If the poll is still open, they can vote again.

A poll that already has votes cannot be switched from anonymous to named, because the people who voted were told their choice was private.

## On your site

**When to show results** on the poll form decides what visitors see:

| Setting | Before voting | After voting | After the poll closes |
| --- | --- | --- | --- |
| Always | Answers and the Vote button | Results with bars | Results with bars |
| After voting | Answers, and "Results will show after you vote." | Results with bars | Results with bars, for everyone |
| After the poll closes | Answers, and "Results will show after the poll closes." | "You voted." | Results with bars |

![The same poll on a phone in dark mode](../images/poll-results-phone-dark.webp)

**Numbers visitors see** chooses between a percent and a count next to each answer, or the percent only. Admin always shows both.

## Dashboard

The EmDash dashboard has an **Open polls** card that lists the polls open right now with their vote counts.
