---
name: scorebrawl-ui-patterns
description: UI patterns for Scorebrawl views. Use when creating new list views, dialogs, forms, or any UI following existing design patterns. Covers RowCard usage, bordering, dialog headers, responsive actions, and page layouts.
language: typescript,tsx
framework: react,tanstack-router,tailwindcss
---

# Scorebrawl UI Patterns

Design system for Scorebrawl views. Sharp borders (no radius), RowCard lists, responsive action buttons.

## Core Patterns

### Header with Breadcrumbs

The Header component accepts a `breadcrumbs` prop for navigation:

```tsx
import { Header } from "@/components/layout/header";

// Basic breadcrumb (last item has no href = current page)
<Header
  breadcrumbs={[
    { name: "League", href: "/leagues" },
    { name: "my-league", href: "/leagues/my-league" },
    { name: "Seasons" },
  ]}
/>

// With right content (action button)
<Header
  breadcrumbs={[
    { name: "League", href: "/leagues" },
    { name: "my-league", href: "/leagues/my-league" },
    { name: "Seasons" },
  ]}
  rightContent={
    <GlowButton icon={Add01Icon} glowColor={glowColors.blue} size="sm">
      Season
    </GlowButton>
  }
/>

// Standalone page (no sidebar, with logout)
<Header includeLogoutButton rightContent={<Button>Action</Button>} />
```

**BreadcrumbItem type:**
```tsx
interface BreadcrumbItem {
  name: string;
  href?: string;  // omit for current page (last item)
}
```

### List View Structure

Template for list views (seasons, members, invitations):

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RowCard } from "@/components/ui/row-card";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/items")({
  component: ItemsPage,
});

function ItemsPage() {
  const { slug } = Route.useLoaderData();
  
  return (
    <>
      <Header
        breadcrumbs={[
          { name: "League", href: "/leagues" },
          { name: slug, href: `/leagues/${slug}` },
          { name: "Items" },
        ]}
        rightContent={
          <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            Item
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Stats Cards */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Title</CardTitle>
              <HugeiconsIcon icon={Icon} className="size-4 text-color" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold">{count}</div>
              <p className="text-xs text-muted-foreground">Description</p>
            </CardContent>
          </Card>
        </div>
        {/* List Container */}
        <div className="bg-muted/50 min-h-[100vh] flex-1 md:min-h-min p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : items.length === 0 ? (
            <EmptyState onCreate={() => setIsCreateOpen(true)} />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Items</h3>
                <span className="text-sm text-muted-foreground">Showing {items.length}</span>
              </div>
              <div className="divide-y divide-border border">
                {items.map((item) => (
                  <RowCard
                    key={item.id}
                    icon={<IconComponent />}
                    title={item.name}
                    subtitle={<><span>Detail 1</span><span>•</span><span>Detail 2</span></>}
                  >
                    <StatusBadge status={item.status} />
                    <ActionButtons item={item} />
                  </RowCard>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

### RowCard Usage

Always wrap in `divide-y divide-border border`:

```tsx
<div className="divide-y divide-border border">
  {items.map((item) => (
    <RowCard
      key={item.id}
      icon={<HugeiconsIcon icon={Icon} className="size-5 text-primary" />}
      iconClassName="bg-primary/10"  // optional colored bg
      title={item.name}
      subtitle={
        <>
          <span>{value1}</span>
          <span>•</span>
          <span>{value2}</span>
        </>
      }
    >
      {/* Action buttons */}
    </RowCard>
  ))}
</div>
```

### Dashboard Cards with Glow Effects

For dashboard overview cards, use glow effects with themed colors:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";

interface DashboardCardProps {
  title: string;
  icon: IconSvgElement;
  children: ReactNode;
  glowColor?: string;
  iconColor?: string;
}

export function DashboardCard({ title, icon, children, glowColor, iconColor }: DashboardCardProps) {
  return (
    <Card className="relative overflow-hidden">
      {glowColor && (
        <div className={`absolute inset-0 ${glowColor}`} />
      )}
      <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <HugeiconsIcon icon={icon} className={`size-4 ${iconColor || "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent className="relative">{children}</CardContent>
    </Card>
  );
}
```

**Glow Color Palette:**
- Red/Fire: `bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.1),transparent_60%)]` + `text-red-600`
- Blue/Cool: `bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]` + `text-blue-600`
- Green/Success: `bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]` + `text-emerald-600`
- Amber/Warning: `bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),transparent_60%)]` + `text-amber-600`
- Yellow/Caution: `bg-[radial-gradient(circle_at_top_right,_rgba(234,179,8,0.12),transparent_60%)]` + `text-yellow-600`

**Usage example:**
```tsx
<DashboardCard 
  title="On Fire" 
  icon={FireIcon}
  glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(239,68,68,0.1),transparent_60%)]"
  iconColor="text-red-600"
>
  <div className="text-2xl font-bold">{topPlayer.score}</div>
  <p className="text-xs text-muted-foreground">{topPlayer.name}</p>
</DashboardCard>
```

### Responsive Action Buttons

Desktop text, mobile icons:

```tsx
<Button variant="ghost" size="sm" onClick={handleAction}>
  <span className="hidden sm:inline">Edit Item</span>
  <span className="sm:hidden">
    <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
  </span>
</Button>
```

### Status Badges

Colored badge, text hidden on mobile:

```tsx
function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: "bg-green-500/10 text-green-600 border-green-500/20",
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    ended: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      <StatusIcon status={status} />
      <span className="hidden sm:inline capitalize">{status}</span>
    </div>
  );
}
```

### Empty State

```tsx
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
        <HugeiconsIcon icon={Icon} className="size-5" />
      </div>
      <p>No items yet</p>
      <Button variant="outline" className="gap-1.5" onClick={onCreate}>
        <HugeiconsIcon icon={Add01Icon} className="size-4" />
        Create First Item
      </Button>
    </div>
  );
}
```

### Dialog Headers

```tsx
<DialogHeader>
  <DialogTitle>Dialog Title</DialogTitle>
  <DialogDescription>Description text here.</DialogDescription>
</DialogHeader>
```

Or with visual accent:

```tsx
<DialogHeader className="pb-4 border-b border-border">
  <div className="flex items-center gap-3">
    <div className="w-2 h-6 bg-purple-500 rounded-full" />
    <DialogTitle>Create Item</DialogTitle>
  </div>
</DialogHeader>
```

### Form Dialogs

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Create Item</DialogTitle>
      <DialogDescription>Fill details below.</DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      {/* Form fields */}
    </div>
    <DialogFooter>
      <Button onClick={handleSubmit}>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Standalone Page Header

For pages without sidebar (e.g., /leagues):

```tsx
<Header
  includeLogoutButton
  rightContent={
    <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
      <HugeiconsIcon icon={Add01Icon} className="size-4" />
      League
    </Button>
  }
/>
```

Note: Standalone pages don't use `breadcrumbs` prop - Header renders children or nothing for the left side.

## Key Rules

1. **No border radius**: Components use `rounded-none` (sharp corners)
2. **Borders**: Use `border` class, never rely on default card borders
3. **RowCard lists**: Always wrap in `divide-y divide-border border`
4. **Responsive actions**: Desktop text (`hidden sm:inline`), mobile icons (`sm:hidden`)
5. **Status badges**: Always hide text on mobile with `hidden sm:inline`
6. **Icons**: Use Hugeicons (`@hugeicons/react`, `@hugeicons/core-free-icons`)
7. **Icon sizing**: `size-4` for inline, `size-5` for row icons
8. **Spacing**: `gap-1.5` for button icons, `gap-3` for row gaps
9. **Buttons**: `size="sm"` for page actions, `variant="ghost"` for row actions
10. **Container padding**: `p-6` for list containers
11. **Empty state height**: `h-64` for consistent centering
12. **Dashboard card glows**: Use themed radial gradient glows with matching icon colors (see Dashboard Cards section)

## File Structure

List views: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/feature.tsx`
Components: `apps/web/src/components/feature/component-name.tsx`
Dialog forms: `apps/web/src/components/feature/feature-form.tsx`

Route file naming (TanStack Router):
- Use directory structure, never dot notation
- `leagues/index.tsx` and `leagues/create.tsx`
- NOT `leagues.tsx` and `leagues.create.tsx`
