# Business rules

Functional specification of the product. Every rule is enforced on the server and covered by
tests; the references after each section point to the code that enforces it.

- [Profiles](#1-profiles)
- [Chores](#2-chores)
- [Allowance](#3-allowance)
- [Points, levels and streaks](#4-points-levels-and-streaks)
- [Rewards](#5-rewards)
- [Sibling marketplace](#6-sibling-marketplace)
- [Calendar](#7-calendar)
- [Meals](#8-meals)
- [Notifications](#9-notifications)
- [Time cycles](#10-time-cycles)
- [Permission matrix](#11-permission-matrix)

---

## 1. Profiles

Four fixed profiles defined in `public/perfiles.js`: **three children** (mobile experience) and
**the parents' dashboard** (desktop experience). There is no sign-up and no password: each device
picks a profile once and remembers it.

Picking a profile is not authentication. This is a product decision: a child should be able to
use the app without friction, and the rules that matter are enforced by the server
([ADR-0003](adr/0003-fixed-profiles-without-accounts.md)).

## 2. Chores

| Type | Example | Tracking | Approval | Counts towards |
|---|---|---|---|---|
| **Daily fixed** | Make the bed | one checkbox per day | no | allowance, points, streak |
| **Weekly fixed** | Do a load of laundry | "Done" | yes | allowance, points |
| **Extra** | Clean the bathroom (40 pts) | "Done" | yes | extra money, points |

- Fixed chores are the same for every child.
- Extra chores are **assigned every month** using a weighted split: each chore weighs its points
  and each child receives load in proportion to their availability (normal = 1, reduced = 0.6,
  minimal = 0.3). The assignment is deterministic. — `public/index.html` (`generateMonth`),
  `test/dinero.test.js`
- A submitted chore stays pending until the parents approve it or send it back.

## 3. Allowance

The app does not move money: it calculates what each child has earned.

| Weekly completion of fixed chores | Result |
|---|---|
| < 75 % | no fixed allowance |
| ≥ 75 % | fixed allowance (€8 by default) |
| 100 % | fixed allowance **+** approved extra chores × point value (€0.05 by default) |

Reaching 100 % is what **unlocks** the money from extra chores.

*Units:* each ticked day of a daily chore is worth 1 and each approved weekly chore is worth 1.
With 3 daily chores and 1 weekly chore there are 22 units per week; 75 % is 17. —
`services/puntos.js`, `test/dinero.test.js`

## 4. Points, levels and streaks

- **Monthly points** = fixed-chore units × 2 + points from approved extra chores ± marketplace
  bonuses. — `services/puntos.js`
- **Level** = one every 100 points.
- **Streak** = consecutive days with every daily chore ticked. The current day does not break it
  until it ends; it carries over between weeks if Sunday was complete. **It is always computed by
  the server.** — `services/rachas.js`, `test/rachas.test.js`

## 5. Rewards

1. Parents define rewards with a point cost and optional stock.
2. A child requests one: their points are **reserved** immediately, so the same points cannot be
   spent twice.
3. Parents grant it (points are consumed and stock decreases) or deny it (points are released).

## 6. Sibling marketplace

A child can offer one of their extra chores:

- **for points** ("I'll give you 8 points if you do it"), or
- **as a swap** for another chore.

Another sibling requests it or proposes the swap, and **the seller decides**. Agreed bonuses are
only settled once the chore is approved. The marketplace is cleared when the month closes. —
`test/mercado.test.js`

## 7. Calendar

Answers the question *when does everyone do their chores?*

- **Schedules**: each child's busy blocks (school, activities) with days and times.
- **Slots**: morning 09–14, afternoon 14–20, evening 20–23. A slot is free if at least
  **45 minutes** remain outside busy blocks.
- **Planner** (`planificarSemana`), deterministic and without randomness:
  1. only places what is missing and keeps anything placed by hand;
  2. sorts extra chores by points (descending), then weekly fixed chores;
  3. picks the free slot that minimizes, in this lexicographic order: that child's chores on that
     day, total chores in that slot and day, landing on a weekend, and slot preference
     (afternoon first);
  4. returns whatever does not fit.
- A chore placed in a busy slot is flagged as a **conflict**, but it is allowed (parents decide).
- The plan is a **template** repeated every week; cycles never reset it.
- Daily chores are not part of the calendar: they happen every day.

— `test/calendario.test.js`

## 8. Meals

A dish database per meal (breakfast, lunch, dinner) and a week with one dish per meal; it can be
generated randomly from the database. — `test/menus.test.js`

## 9. Notifications

Web Push on every device that enables it. On iOS it requires the app to be installed on the home
screen (iOS 16.4+).

**Event-driven** (never sent to whoever made the change; several for the same person are grouped
into one):

| Event | Recipient |
|---|---|
| A child submits a weekly or extra chore | parents |
| Parents approve / send back | that child |
| A child requests a reward | parents |
| Parents grant / deny it | that child |
| A sibling requests a chore in the marketplace | the seller |
| The seller accepts / rejects | the requester |

**Daily reminder** (17:00–21:30, once a day):

- to each child, today's planned chores that are still pending and any unticked daily chores; a
  child with nothing pending receives nothing;
- to the parents, the number of items awaiting approval.

— `services/avisos.js`, `test/avisos.test.js`

## 10. Time cycles

Decided by the server clock in the `TZ_FAMILIA` time zone.

| Cycle | Effect |
|---|---|
| Every Monday | fixed-chore checkboxes are cleared; the streak carries over if Sunday was complete; extra chores are untouched |
| Every 1st of the month | pending chores become *late*; the monthly summary is archived (points, completed and late chores per child); assignment and marketplace are cleared; calendar and schedules are kept |

— `services/ciclos.js`, `test/ciclos.test.js`, `test/cierre-mes.test.js`

## 11. Permission matrix

| Action | Child | Parents |
|---|:-:|:-:|
| Tick their own daily chores | ✅ | ✅ |
| Submit their own weekly and extra chores | ✅ | ✅ |
| Approve, send back, mark as late | ❌ | ✅ |
| Change another child's chores | ❌ | ✅ |
| Request rewards, trade in the marketplace | ✅ | — |
| Allowance, point value, catalogs, rewards | ❌ | ✅ |
| Calendar and schedules | read | ✅ |
| Streaks and history | read | read (written by the server) |
| Backups, reset, restore, reminders | ❌ | ✅ |

Enforced by `applyChildLimits()` and `soloPapas` regardless of what the client does. —
`services/stateGuard.js`, `test/permisos.test.js`
