# OS Codebase Audit
**Date:** 2026-03-09  
**Scope:** User deletion/deactivation flow, outbound notifications, registered consumers, application schema

---

## 1. Does a DELETE /users/:id endpoint exist?

**Yes.** It exists in `apps/os-backend/src/users/users.controller.ts`.

### Controller decorator stack

```typescript
// DELETE /users/:id — admin only
@Delete(':id')
@UseGuards(RolesGuard)
@Roles('admin')
delete(@Param('id') id: string, @Request() req) {
  return this.usersService.delete(id, req.user.id);
}
```

Guards applied (inherited from controller + method level):
1. `JwtAuthGuard` — class-level `@UseGuards(JwtAuthGuard)` on `@Controller('users')`
2. `RolesGuard` — method-level
3. `@Roles('admin')` — method-level role requirement

### Service method (`users.service.ts`)

```typescript
async delete(id: string, requesterId: string) {
  if (id === requesterId) {
    throw new BadRequestException('You cannot delete your own account');
  }
  const user = await this.usersRepo.findOne({
    where: { id },
    relations: ['userType'],
  });
  if (!user) throw new NotFoundException('User not found');
  if (user.userType?.slug === 'admin') {
    throw new BadRequestException('Admin accounts cannot be deleted');
  }

  // Remove FK-constrained child rows before deleting the user
  await this.accessRepo.delete({ user: { id } });
  await this.clientOrgMappingRepo.delete({ user: { id } });

  await this.usersRepo.remove(user);
  return { message: 'User deleted' };
}
```

**This is a hard delete.** The row is permanently removed from the `users` table via `usersRepo.remove(user)`. There is no soft-delete, no `deleted_at` timestamp, and no archival.

---

## 2. Does PATCH /users/:id handle `is_active = false`?

**Yes.** The update endpoint accepts `is_active` in the body.

### Controller

```typescript
// PATCH /users/:id — admin only
@Patch(':id')
@UseGuards(RolesGuard)
@Roles('admin')
update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
  return this.usersService.update(id, dto, req.user.id);
}
```

### Full `update()` method (`users.service.ts`)

```typescript
async update(id: string, dto: UpdateUserDto, requesterId: string) {
  if (dto.is_active === false && id === requesterId) {
    throw new BadRequestException('You cannot deactivate your own account');
  }
  const user = await this.usersRepo.findOne({ where: { id } });
  if (!user) throw new NotFoundException('User not found');

  if (dto.name !== undefined) user.name = dto.name;
  if (dto.is_active !== undefined) user.is_active = dto.is_active;

  if (dto.department_id !== undefined) {
    if (dto.department_id === null) {
      user.department = null;
    } else {
      const department = await this.deptRepo.findOne({
        where: { id: dto.department_id },
      });
      if (!department) throw new NotFoundException('Department not found');
      user.department = department;
    }
  }

  const saved = await this.usersRepo.save(user);
  return this.sanitize(
    (await this.usersRepo.findOne({
      where: { id: saved.id },
      relations: ['userType', 'department', 'clientOrgMappings', 'clientOrgMappings.organization'],
    }))!
  );
}
```

**What happens when `is_active = false`:**
- The `is_active` column on the `users` row is set to `false` and saved.
- No tokens are revoked, no sessions are invalidated, no JWTs are blacklisted.
- The user's existing JWT remains valid until it naturally expires.
- `getMe()` checks `where: { is_active: true }` — so an inactive user calling `/users/me` will receive `NotFoundException('User not found')`. They are effectively locked out on the next request that re-validates identity, but any in-flight valid JWT can still reach endpoints that do not call `getMe()`.

---

## 3. Any outbound HTTP calls on user deletion or deactivation?

**No.** A full-text search across all `.ts` files in the backend found zero occurrences of:

| Pattern searched | Result |
|---|---|
| `fetch(` | Not found |
| `HttpService` | Not found |
| `axios` | Not found (only in frontend `api.ts`) |
| `EventEmitter` | Not found |
| `webhook` | Not found |

Neither `users.service.ts` nor `users.controller.ts` makes any outbound call when a user is deleted or deactivated. The operation is entirely local to the database.

---

## 4. Is there a list of registered apps/consumers that OS could notify?

**No.** There is no webhooks table, no `app_urls` table, no callback registry, and no event bus configured. The only entities in the database schema are:

| Entity file | Table |
|---|---|
| `application.entity.ts` | `applications` |
| `client-organization.entity.ts` | `client_organizations` |
| `department.entity.ts` | `departments` |
| `sso-token.entity.ts` | `sso_tokens` |
| `user-app-access.entity.ts` | `user_app_access` |
| `user-client-org-mapping.entity.ts` | `user_client_org_mappings` |
| `user-type.entity.ts` | `user_types` |
| `user.entity.ts` | `users` |

The `applications` table stores only `slug`, `name`, `url`, `icon_url`, and `is_active`. There is no `webhook_url`, `callback_url`, or `notification_endpoint` column. OS has no mechanism to inform downstream apps that a user was deleted or deactivated.

---

## 5. Full `applications` table schema

From `apps/os-backend/src/database/entities/application.entity.ts`:

```typescript
@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;      // e.g. 'superfreight', 'tez', 'trainings', 'shakti'

  @Column()
  name: string;

  @Column()
  url: string;

  @Column({ type: 'varchar', nullable: true })
  icon_url: string | null;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => UserAppAccess, (access) => access.application)
  userAccess: UserAppAccess[];
}
```

**Current rows** (from DB query run during a prior session):

| slug | name | is_active | icon_url |
|---|---|---|---|
| `superfreight` | SuperFreight | true | null |
| `tez` | Tez | true | null |
| `trainings` | Trainings | true | null |
| `shakti` | Shakti | false | null |

> Note: `icon_url` was added to the entity to support image upload. If migrations have not been run since the entity was updated, the column may not yet exist in the live DB.

---

## 6. Full delete/deactivate method

Both are documented above in sections 1 and 2. Summary:

- **Delete** (`delete()` in `users.service.ts`): hard-deletes the `users` row after removing `user_app_access` and `user_client_org_mapping` child rows. No soft-delete. No external notification.
- **Deactivate** (`update()` in `users.service.ts`): sets `is_active = false` on the row. No token revocation. No external notification. The user is locked out only when `getMe()` is next called (returns 404).

---

## 7. Frontend delete/deactivate handlers

Both handlers live in `apps/os-frontend/src/app/dashboard/admin/page.tsx`.

### Deactivate (`toggleActive`)

```typescript
async function toggleActive(u: User) {
  if (u.id === user?.id) return; // cannot deactivate own account
  await updateUser(u.id, { is_active: !u.is_active });
  setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
}
```

- No confirmation dialog.
- Calls `PATCH /users/:id` with `{ is_active: false/true }`.
- Optimistically updates local UI state.
- If the API call throws, the UI state is **not rolled back** — the displayed status will be wrong until the page is reloaded.

### Delete (`handleDelete`)

```typescript
async function handleDelete(u: User) {
  if (u.id === user?.id) return;
  if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
  await deleteUser(u.id);
  setUsers(prev => prev.filter(x => x.id !== u.id));
}
```

- Uses a native `window.confirm()` for confirmation.
- Calls `DELETE /users/:id`.
- Removes the user from local state on success.
- If the API call throws, the user remains in the UI (no explicit error handling — unhandled Promise rejection).

### Trigger visibility in the table

- The **Deactivate/Activate** button is rendered for all users where `u.id !== currentUser.id`.
- The **Delete** button is rendered only when `u.userType?.slug !== 'admin'` (admin rows have no delete button on screen, matching backend protection).
- The `[id]/page.tsx` (individual user detail) page shows only app-access toggles — it has **no delete or deactivate controls**.

---

## Summary of Gaps / Risks

| # | Finding | Severity |
|---|---|---|
| 1 | Hard delete — no soft-delete, no audit trail of who was deleted | Medium |
| 2 | Deactivation does not invalidate existing JWTs — token remains valid until expiry | High |
| 3 | No outbound notification to downstream apps on delete/deactivate | High (if apps cache user state) |
| 4 | `toggleActive` has no error rollback — UI can show wrong state on API failure | Low |
| 5 | `handleDelete` has no error handling — unhandled rejection on API failure | Low |
| 6 | No `webhook_url` or callback mechanism in `applications` table | High (by design gap) |
