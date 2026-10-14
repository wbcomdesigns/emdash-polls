# Polls - Role matrix

Derived from `src/plugin.ts` and `src/core.ts`. Re-derive when those files change.

EmDash roles on the lab: anonymous, subscriber (10), contributor (20), author (30), editor (40), admin (50). Plugin gates are host permissions, not WordPress caps.

`MEMBER` = `content:read` (lowest signed-in role). Admin and editor panel routes have no `public` and no `MEMBER`, so the host treats them as staff.

Legend: **Y** allowed · **N** denied · **-** not applicable

## Capability grants

| Permission | anonymous | subscriber | contributor | author | editor | admin |
| --- | --- | --- | --- | --- | --- | --- |
| public routes | Y | Y | Y | Y | Y | Y |
| `schema:read` (content type names) | N | N | N | N | Y | Y |
| `content:read` (MEMBER) | N | Y | Y | Y | Y | Y |
| staff plugin admin | N | N | N | N | Y | Y |

## Surfaces

| Surface | Route / endpoint | anonymous | member-owner | member-other | elevated | admin |
| --- | --- | --- | --- | --- | --- | --- |
| Read poll | `GET get`, `GET slot` | Y | Y | Y | Y | Y |
| Guest vote / ballot | `POST vote_guest`, `GET ballot_guest` | Y | - | - | - | - |
| Member vote / ballot | `POST vote`, `GET ballot` | N | Y | Y | Y | Y |
| My votes | `GET/DELETE mine` | N | Y | N | Y | Y |
| Admin pages | `POST admin` | N | N | N | Y | Y |
| Editor Poll panel | `editor_poll` | N | N | N | Y | Y |

## Visibility

| Level | anonymous | member-owner | member-other | elevated | admin |
| --- | --- | --- | --- | --- | --- |
| Anyone poll | vote + see per results rule | same | same | same | same |
| Members poll | see question, cannot vote | vote | vote | vote | vote |
| Named results | totals only | own notice before vote | other names hidden in kit | - | names on Results |
| Anonymous results | totals only | totals only | totals only | totals only | totals only |

## Known bypasses

| Bypass | Applies to | Why it is correct |
| --- | --- | --- |
| Lab `dev-bypass` | the one `dev@emdash.local` account | Local setup only. Not a production gate. |
| `lab-role.sh` | same account, flipped role | One login. Use it for subscriber then admin. |

## Deliberate denials

| Surface | Role | Denied because |
| --- | --- | --- |
| `vote` / `ballot` | guest | Host MEMBER permission. Guests use `*_guest`. |
| Attach one page from the admin form | admin | Entry attach is the editor Poll panel (#14). |
| Open on a closed row | admin | Closed rows have no Open action. |
