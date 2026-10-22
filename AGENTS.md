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
- All catalog writes go through `catalogRepo` (src/lib/repository.ts, Lovable Cloud); pages never write tables directly, so storage can change in one place.
- Catalog reads use `useCatalog()` (TanStack Query, key ["catalog"]); invalidate that key after writes so every screen sees shared data.
- Permissions live in database rules (user_roles, market_members, has_role/can_manage_market); UI checks are only cosmetic.
- Product photos live in the private `product-images` bucket and are shown through signed URLs (workspace blocks public buckets).
- The shopping list stays in localStorage for now; moving it to the account is pending.
- Shopping list syncs through src/lib/list-sync.ts (localStorage is the working copy, pushed to shopping_list_items when signed in); keeps screens unchanged.
