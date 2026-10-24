# Dummy / hardcoded data in kero-admin

Last updated: 16 Oct 2026.

## Current state

All demo fallbacks have been removed. When an API call fails, the page now shows the real
error or an empty state instead of invented rows, and stats are computed from real data.

## Still not backed by the API

These features have **no backend module**. They no longer show fake records; each page says it
isn't connected yet.

| Feature | What's missing | Effort to add |
|---|---|---|
| **People (HR)** — staff, expense claims, leave | No Prisma models or `/admin/hr/*` routes. | Medium: 3 models (Employee, ExpenseClaim, LeaveRequest) + CRUD + approve/decline routes. The UI tables and forms already exist. |
| **Settings → Anti-fraud** — device/GPS rules, flagged devices | No config table or endpoint. Some related fields exist on `ReferralConfig` (`requireUniqueDevice`, `maxSameDeviceReferrals`) and `Driver.deviceId`. | Small–medium: a `FraudConfig` singleton + GET/PUT like `cash-config`. Flagged devices needs a `FlaggedDevice` table fed by the auth/device checks. |
| **Rewards → Driver milestones** (the "Weekend 25-trip sprint"-style challenges) | No milestone model; removed from the page. | Medium: `Milestone` model + CRUD, plus a job in trip completion that credits `bonusBalance`. |

## Actions that still only show a toast

| Page | Action | Effort |
|---|---|---|
| Settlements → Payouts | "Retry payout" | Small, if the payments module exposes a transfer retry. |
| Settlements → Arrears | "Send reminder" | Small: reuse the existing outstanding-fee reminder job (`lastReminderAt` already tracked). |

## Fixed in this pass (were fake or broken)

- Removed demo fallback data from Banners, Push, Pricing, Surge, Fleet (vehicles, zones,
  maintenance), Settlements and Rewards.
- Audit trail: removed `MOCK_AUDIT_LOGS`, invented IPs/emails/IDs, and the 18,492 / 6 /
  "7 years" figures. Search and outcome filters are now applied by the API (new `search` param).
- Rewards: the referral config used field names the API doesn't return (and its save sent
  fields the API rejects). It now reads and writes the real `referrerRewardValueKobo`,
  `referredRewardValueKobo`, `minTripsForUnlock` and `unlockWindowDays`.
- Settlements: payouts called a non-existent route (`/admin/transactions`); arrears and gateway
  cards showed fields the API doesn't return.
- Hardcoded stats replaced with computed ones: SOS avg resolution, empty depots, pricing take
  rate, surge caps, corridor totals, referral amounts.
- Live watch no longer draws drivers at guessed positions when they have no GPS fix.
- Review queue no longer claims "NIMC: Verified".
- Overview "Create dispatch" now opens the real dispatch form on Trips.
- Settings → Dispatch: `/admin/dispatch-config` returned 500 after the first cached read
  (date serialisation); fixed in the backend.
