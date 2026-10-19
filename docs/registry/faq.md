**I updated the plugin and voting stopped.**
Copy the site kit again. A registry install answers at an id, not at `/polls/`. The current kit finds that id.

**Why is there no poll on the page after I create one?**
Create is a draft. Open the poll from the list. Then attach it to a page, a content type or the whole site, and put a poll slot on that template.

**Can guests vote?**
Yes, when you set Who can vote to Anyone and the host gives EmDash the visitor's address: on Cloudflare, or with `trustedProxyHeaders` set to a header your proxy writes itself and replaces (behind nginx, `x-real-ip`; never an appended `X-Forwarded-For`). Without it, guests are asked to sign in, and the Polls screen says so. One vote per visitor. Signed-in members vote as themselves.

**Is a 401 in the browser console a problem?**
No. A guest gets one 401 per poll from the member ballot check, and one on My votes. That is how the poll learns the visitor is not signed in. It then shows the guest view.

**Who sees voter names?**
Only you, and only on a named poll. Guests stay anonymous. Anonymous polls never store a name.

**Does it work in dark mode?**
Yes. The kit follows the visitor's system setting.

**Can I put a poll in the middle of an article?**
Not from a registry install. Attach it above or below the content, or place `<Poll id />` in a template. An in-text block needs a trusted install; that path is optional and does not change the registry product.

**Is there a paid version?**
No. Everything here is free.

**Why does it ask to read my content?**
So a poll attached to a draft stays hidden until you publish that page. WB Polls only checks whether a page is published and lists your content types by name.
