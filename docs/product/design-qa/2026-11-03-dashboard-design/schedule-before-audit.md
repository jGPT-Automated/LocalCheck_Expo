# Visual QA

5 screens x 3 sizes. Screenshots in /workspace/shared/dashboard-design/schedule-before/<size>/<screen>.png.

## Failures (3)
- 375x667 schedule-actions: could not reach this state (locator.click: Timeout 4000ms exceeded.)
- 393x852 schedule-actions: could not reach this state (locator.click: Timeout 4000ms exceeded.)
- 430x932 schedule-actions: could not reach this state (locator.click: Timeout 4000ms exceeded.)

## Above baseline (14)
- 375x667/schedule: smallTarget 89 (baseline 58): SAT 17, 4 AM, 0 going (39x20); SUN 18, 4 AM, 0 going (39x20); MON 19, 4 AM, 0 going (39x20); TUE 20, 4 AM, 0 going (39x20); WED 21, 4 AM, 0 going (39x20); THU 22, 4 AM, 0 going (39x20)
- 375x667/schedule-slot: smallTarget 87 (baseline 58): SAT 17, 4 AM, 0 going (39x24); SUN 18, 4 AM, 0 going (39x24); MON 19, 4 AM, 0 going (39x24); TUE 20, 4 AM, 0 going (39x24); WED 21, 4 AM, 0 going (39x24); THU 22, 4 AM, 0 going (39x24)
- 375x667/schedule-mine: smallTarget 89 (baseline 58): SAT 17, 12 PM, 0 going (39x20); SUN 18, 12 PM, 0 going (39x20); MON 19, 12 PM, 0 going (39x20); TUE 20, 12 PM, 0 going (39x20); WED 21, 12 PM, 0 going (39x20); THU 22, 12 PM, 0 going (39x20)
- 375x667/schedule-actions: smallText 15 (baseline 5): SAT (9px); SUN (9px); MON (9px); TUE (9px); WED (9px); THU (9px)
- 375x667/schedule-actions: smallTarget 89 (baseline 0): SAT 17, 4 AM, 0 going (39x20); SUN 18, 4 AM, 0 going (39x20); MON 19, 4 AM, 0 going (39x20); TUE 20, 4 AM, 0 going (39x20); WED 21, 4 AM, 0 going (39x20); THU 22, 4 AM, 0 going (39x20)
- 393x852/schedule: smallTarget 89 (baseline 59): SAT 17, 4 AM, 0 going (41x35); SUN 18, 4 AM, 0 going (41x35); MON 19, 4 AM, 0 going (41x35); TUE 20, 4 AM, 0 going (41x35); WED 21, 4 AM, 0 going (41x35); THU 22, 4 AM, 0 going (41x35)
- 393x852/schedule-slot: smallTarget 87 (baseline 59): SAT 17, 4 AM, 0 going (41x39); SUN 18, 4 AM, 0 going (41x39); MON 19, 4 AM, 0 going (41x39); TUE 20, 4 AM, 0 going (41x39); WED 21, 4 AM, 0 going (41x39); THU 22, 4 AM, 0 going (41x39)
- 393x852/schedule-mine: smallTarget 89 (baseline 59): SAT 17, 12 PM, 0 going (41x35); SUN 18, 12 PM, 0 going (41x35); MON 19, 12 PM, 0 going (41x35); TUE 20, 12 PM, 0 going (41x35); WED 21, 12 PM, 0 going (41x35); THU 22, 12 PM, 0 going (41x35)
- 393x852/schedule-actions: smallText 15 (baseline 5): SAT (9px); SUN (9px); MON (9px); TUE (9px); WED (9px); THU (9px)
- 393x852/schedule-actions: smallTarget 89 (baseline 0): SAT 17, 4 AM, 0 going (41x35); SUN 18, 4 AM, 0 going (41x35); MON 19, 4 AM, 0 going (41x35); TUE 20, 4 AM, 0 going (41x35); WED 21, 4 AM, 0 going (41x35); THU 22, 4 AM, 0 going (41x35)
- 430x932/schedule: smallTarget 89 (baseline 59): SAT 17, 4 AM, 0 going (46x42); SUN 18, 4 AM, 0 going (46x42); MON 19, 4 AM, 0 going (46x42); TUE 20, 4 AM, 0 going (46x42); WED 21, 4 AM, 0 going (46x42); THU 22, 4 AM, 0 going (46x42)
- 430x932/schedule-mine: smallTarget 89 (baseline 59): SAT 17, 12 PM, 0 going (46x42); SUN 18, 12 PM, 0 going (46x42); MON 19, 12 PM, 0 going (46x42); TUE 20, 12 PM, 0 going (46x42); WED 21, 12 PM, 0 going (46x42); THU 22, 12 PM, 0 going (46x42)
- 430x932/schedule-actions: smallText 15 (baseline 5): SAT (9px); SUN (9px); MON (9px); TUE (9px); WED (9px); THU (9px)
- 430x932/schedule-actions: smallTarget 89 (baseline 0): SAT 17, 4 AM, 0 going (46x42); SUN 18, 4 AM, 0 going (46x42); MON 19, 4 AM, 0 going (46x42); TUE 20, 4 AM, 0 going (46x42); WED 21, 4 AM, 0 going (46x42); THU 22, 4 AM, 0 going (46x42)

## Apple minimums still owed (all screens, all sizes)
- Text under 11pt: 183
- Text under 4.5:1 contrast (3:1 large): 0
- Controls under 44x44pt (hitSlop not visible on web): 978
