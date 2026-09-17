# Programme options scan — 14 September 2026

Inspected the current frontend and backend checkouts, excluding dependencies, generated output, other worktrees, migrations and test fixtures from the active-code findings. Searched programme category constants, literal UG/PG/CAT lists, programme_type, programmeType and the Analytics programme filters. This is a code scan with local Analytics API verification; production was not queried or changed.

## Fixed in Analytics

- All Analytics viewers use active programme records from `/analytics/filters/programmes`, with effective scope enforced by the backend. Shared viewers retain their active-seat restriction.
- The searchable dropdown uses programme names and sends `programme_id`, rather than sending a category such as UG.
- State, zone and school options pass the selected programme ID and use separate cache entries per programme.
- The scope badge displays the chosen programme name. Programme-list errors offer Retry.
- Existing cached empty lists for staff were bypassed with a new programme-list cache version.
- Local API checks: admin received three active programmes; PM received its two reachable programmes. The archived programme was absent. Selecting a programme returned exactly its ID in the response scope.

## Remaining user-facing category filters

These are scan findings, not changes made in this task. Replacing their option values with UUIDs alone would be incorrect: their data contracts currently consume programme categories.

| Surface | Finding | Code pointer |
| --- | --- | --- |
| Attendance → School Confirmations | **Broken filter:** the Audience picker offers `programme:UG/PG/CAT`, but its predicate handles only course and batch; every other value returns true. Choosing a programme silently leaves the list unfiltered. | `opengradhub-frontend/app/dashboard/attendance/_components/SchoolConfirmationsTab.tsx`, programme optgroup and `sorted` predicate |
| Calendar create/edit | **Hardcoded older pair:** `PROGRAMMES = ["", "UG", "PG"]`. CAT is absent too. Audience filtering on the backend compares `calendar_events.programme_type` with the user's category. | `opengradhub-frontend/app/dashboard/calendar/page.tsx`; `opengradhub-backend/src/calendar/calendar.service.ts` |
| Reports | Picker labelled **Batch / All batches** actually offers UG/PG/CAT and sends `programme_type`. It is neither a current batch nor a programme selector. | `opengradhub-frontend/components/reports/StaffReportsView.tsx` |
| Student export | Programme filter uses `PROGRAMME_KINDS` and sends `programme_type` to the student analytics/export API. | `opengradhub-frontend/app/dashboard/student-export/page.tsx`; `opengradhub-backend/src/analytics/analytics.service.ts` |
| User management | Student search/enrolment flows still filter by programme category. Additional kind pickers appear in create/edit flows. | `opengradhub-frontend/app/dashboard/user-management/page.tsx` |
| Course catalogue | “All programmes” means UG/PG/CAT; course listing sends `programme_type`. Current programme ownership also exists separately as `owner_programme_id`. | `opengradhub-frontend/app/dashboard/courses/_components/CourseCatalogue.tsx`; `opengradhub-backend/src/courses/courses.service.ts` |
| Message/announcement composer | “All Programmes / UG Only / PG Only / CAT Only” targets students by their stored category. A UUID requires a matching audience-contract change. | `opengradhub-frontend/components/ComposeMessageModal.tsx`; `opengradhub-backend/src/announcements/announcements.service.ts` |
| Test bank | Category dropdown filters questions by `programme_type`; this is question classification, not ownership by a current programme. | `opengradhub-frontend/app/dashboard/test-bank/page.tsx`; `opengradhub-backend/src/questions/questions.service.ts` |

## Kind metadata and historical fields still present

- Programme creation explicitly asks for **Kind** (UG/PG/CAT). That remains valid metadata on a programme record; it is not an outdated programme list.
- Batch creation, resource create/edit, question editing and user detail forms still contain category fields. Review their intended meaning before converting them to programme ownership or membership.
- Course, batch, student and resource cards/export columns display stored `programme_type`. These labels do not prove that access is category-based; canonical ownership and effective programme scope coexist with this metadata.
- Shared kind constants remain in `opengradhub-frontend/lib/programme-kinds.ts` and `opengradhub-backend/src/common/programme-kinds.ts`. The frontend comment now distinguishes category metadata from record-based programme pickers.
- Analytics still accepts the legacy `programme` category query for compatibility. The updated Insights UI does not send it. The backend also computes an `ug_pg_split` response field from stored categories; the current KPI component does not render that field.
- Category fields remain in backend users, courses, batches, resources, questions/quizzes, bundles, calendar, announcements and notifications code, plus the schema. This scan does not classify all of those references as bugs or recommend deleting historical columns.

## Follow-up order

1. Remove or properly implement the ineffective School Confirmations programme audience filter.
2. Migrate Calendar and announcement audiences with backend enforcement and tests; do not substitute programme IDs into category fields.
3. Migrate Reports, Student Export and user search to programme IDs and label genuine category filters “Programme kind”.
4. Decide whether the course catalogue and question bank need programme ownership filters, kind filters, or both.
