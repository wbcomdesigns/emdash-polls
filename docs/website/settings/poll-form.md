# Poll form reference

**Included in Free.** WB Polls has no paid version.

Every field on the **New poll** and **Edit poll** form, in the order it appears.

![The New poll form with a question, four answers and an optional close date](../images/admin-new-poll.webp)

| Field | What it controls | Default |
| --- | --- | --- |
| Question | The question visitors see. Up to 200 characters | Empty, required |
| Answers (one per line) | 2 to 10 answers, one per line, in the order visitors see them | Empty, required |
| Allow more than one answer | Visitors tick several answers instead of picking one | Off |
| Who can vote | **Anyone**, or **Signed-in members only**. Members-only polls ask guests to sign in | Anyone |
| Show each member's choice to the site owner | A named poll. You see each member's choice in Results, and visitors see a note before voting that their choice is visible to you. Guests stay anonymous | Off |
| When to show results | **Always**, **After voting**, or **After the poll closes** | Always |
| Members may change their vote while the poll is open | Signed-in members can pick again until the poll closes | Off |
| Opens on, Opens at (UTC) | A day and time the poll opens by itself. Leave the day empty to open it by hand | Empty |
| Closes on, Closes at (UTC) | A day and time the poll closes by itself | Empty |
| Thank-you line after voting | A short line shown after a vote. Up to 140 characters | Empty |
| Where it shows | **Not attached**, **Whole site**, or **One content type**. **One page** appears here when the poll was attached from a post editor | Not attached |
| Content type | Which type the poll shows on, by name. Needed for **One content type** | None |
| Position on the page | **Below the content** or **Above the content**. See [Where a poll shows](../features/where-polls-show.md#above-or-below-the-content) | Below the content |
| Numbers visitors see | **Percent and count**, or **Percent only** | Percent and count |

## Rules the form checks

- At least 2 and at most 10 answers.
- The question cannot be empty. Empty lines in the answers are skipped.
- On a poll that has votes, the answers and the one-or-several choice are locked. See [Open, close, copy and delete](../features/manage-polls.md#editing-a-poll-that-has-votes).

## How guest votes are counted

A guest can vote once per poll. WB Polls remembers the vote using the visitor's internet address when your hosting passes it on, and a random code saved in the visitor's browser when it does not. The browser code is easier to get around (a private window clears it), so for polls where one-vote-per-person matters, choose **Signed-in members only**.
