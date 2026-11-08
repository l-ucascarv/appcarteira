<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Financial entries are saved via an authenticated atomic database RPC that optionally records realized movements; deletion removes linked movements to keep all views consistent.
- Separate descriptive category labels from recurrence/type fields so AI suggestions never alter scheduling rules.
- Gateway calls use server-only Responses helpers, authenticated server functions, strict schemas, streamed generation and a durable service-only access-block state; never retry terminal errors.
- The spending analysis is explicitly requested and invalidated when its source entries change; financial reads are user-scoped and transaction histories are paginated rather than capped.
- Read-only monthly reports live at /tags and /comprometido; entry management stays at /lancamentos to preserve existing URLs and separate reporting from mutations.
- Monthly reports and Horizon use shared client-safe occurrence helpers; linked actual movements replace planned occurrences instead of being counted twice.
- The inline entry form derives recurrence and installment RPC arguments through the tested quick-entry helper; photo extraction fills editable fields without changing the user's scheduling choice.
- Removed financial views retain a redirect to entry management so existing URLs remain usable without exposing removed navigation.
- Entry management uses a tested direction-aware chronology comparator and groups occurrences by scheduled date and recorded time; daily and opening balances use shared actual-movement helpers independently of list filters, without inserting carryover transactions.
- Mobile navigation reserves safe-area-aware content space and uses weighted columns so all destination labels remain visible on narrow iPhone screens.
- Mobile presentation is scoped to the finance app shell and page classes through shared CSS tokens; keep desktop layout and financial behavior independent from mobile restyling.
- Financial read queries reuse a short-lived cache across tabs, with mutation invalidation and identity-change cache teardown; navigation preloads visible destinations and entry dialogs load on demand to avoid repeated work without weakening the managed auth gate.
