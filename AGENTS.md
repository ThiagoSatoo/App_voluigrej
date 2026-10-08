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

## Data layer
- Screens read state via `useStore()` + `src/data/selectors.ts` and mutate only through `repo` in `src/data/repository.ts` — so the mock (localStorage) can be swapped for a real database without touching screens.
- Auth is simulated client-side (`useRequireRole`) for the prototype; replace with real auth before production.
- Monthly needs store explicit start/end times; upgrade legacy local shifts during hydration while preserving IDs so availability, draws and history remain linked.
- Both scheduling forms share time-range fields and time helpers so default durations and display formatting stay consistent.
