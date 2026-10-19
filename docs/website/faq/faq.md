# Frequently asked questions

**Included in Free.** WB Polls has no paid version.

## Can guests vote?

Yes, when **Who can vote** is set to **Anyone** and your hosting tells EmDash the visitor's address: on Cloudflare, or with `trustedProxyHeaders` set (see [Guest voting](../getting-started/install.md#guest-voting)). Without it, guests see a sign-in link instead, and the Polls screen says so. Each guest can vote once per poll. Signed-in members always vote as themselves.

## Can a visitor vote twice?

Not on purpose. A guest's vote is counted by their internet address, stored only as a scrambled code. Visitors on the same network (an office, a phone network sharing one address) count as one guest. For polls where one vote per person matters, choose **Signed-in members only**.

## Why does the browser console show a 401?

That is expected for a guest: one per poll from the member ballot check, and one on My votes. The poll asks the member route whether the visitor is signed in, a guest's answer is 401, and the poll then shows the guest view.

## Who can see how someone voted?

Only you, and only on a poll with **Show each member's choice to the site owner** turned on. Visitors are told before they vote. Guests are never named, and anonymous polls never store who voted for what.

## Can I put a poll in the middle of an article?

Not with the registry install. EmDash does not let registry plugins add blocks inside post text. A poll can sit above or below the content, or anywhere your developer places it in a template.

## Can I show different polls on different posts?

Yes. Attach a poll to one post from its editor. It wins over a poll attached to all posts or the whole site. See [Where a poll shows](../features/where-polls-show.md).

## Why are the times in UTC?

EmDash does not tell plugins your site's time zone, so WB Polls cannot convert for you. Pick the UTC time that matches your local time.

## Does it work in dark mode and on phones?

Yes. The poll follows the visitor's light or dark setting and fits a phone screen.

## Does it work with other Wbcom plugins?

Yes. Use it alone or with any of them, in any combination. They share two small kit files; keep the newer copy.

## Is there a paid version?

No. Everything described in these guides is free.
