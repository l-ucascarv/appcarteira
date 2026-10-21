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
