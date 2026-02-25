flowchart TD
A[Coach assigns workout in LC] --> B[LC starts live session]
B --> C[LC writes active_workout JSON
type + start_type + metadata]
C --> D[ErgLink joins session and reads active_workout]
D --> E[Athlete rows on PM5]
E --> F[ErgLink uploads workout_log
source=erg_link_live
raw_data includes group_assignment_id/canonical_name/template_id]
F --> G[LC auto-complete step:
set daily_workout_assignments.completed_log_id
ONLY if currently null]
F --> H[Workout visible in LC history/views]
I[Later C2 sync] --> J[Find possible duplicate]
J --> K[Reconciliation:
prefer higher-trust source, merge/upgrade]
K --> L[Single clean record + assignment remains linked]