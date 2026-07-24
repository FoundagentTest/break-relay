# Break Relay — a screen-free route that makes five minutes feel like leaving work

## Lineage

```json
{
  "generator_session_id": "019f9442-452b-7b92-901c-56e18c05ca5e",
  "generator_task_id": "idea-generate-audience-001-problem-002-g01",
  "idea_id": "audience-001-problem-002-g01-idea-001",
  "idea_ref": "audience-001-problem-002-g01-idea-001",
  "problem_gateway_ref": "problem-review-audience-001-problem-002",
  "problem_ref": "audience-001-problem-002",
  "red_team_ref": "idea-review-audience-001-problem-002-g01-idea-001",
  "red_team_session_id": "019f9449-6c73-7310-afe2-e77bc1996bad",
  "red_team_task_id": "idea-red-team-audience-001-problem-002-g01-idea-001"
}
```

## User

Knowledge workers taking self-chosen five-to-ten-minute breaks at a desk, especially at home, who want a reset without opening a feed or committing to a long activity.

## Problem

A timer supplies empty time, not a transition. When the person remains at the desk, their mind may still be in the task; when they reach for a phone, the break can become more stimulating than restorative and hard to end.

## Product

Break Relay turns a short break into a tiny, repeatable physical route through the user's own space. During setup, a person marks three real “stations” they can reach quickly—such as a window, water tap, doorway, balcony, plant, or stairs. When they choose to take a break, Relay sends them away from the laptop on a route tailored to how they feel: mentally noisy, visually tired, physically stuck, or simply needing air.

It is deliberately an opt-in break starter, not an interruption timer. The product's job is to make the available break feel complete.

## Product Experience

At a natural stopping point, Maya selects “eyes fried” and “7 minutes” from a small desktop control. Her phone stays in her pocket. A soft audio cue tells her only the first destination: “Window.”

At the window, it gives a 40-second outward-looking prompt, such as finding the farthest stationary object she can see. It then quietly sends her to the water station for a slow refill, then to the doorway for a short walk and one breath-length shoulder release. Each cue is concrete enough to occupy the transition but too slight to become content to consume.

A final chime at her desk offers a choice: return now, take a two-minute extension, or end the session. Over time, Relay learns which routes leave her choosing “ready” rather than extending or abandoning the break, and favors those routes. No scrolling feed, streak, productivity score, or prescribed schedule is needed.

## Core Mechanism

Relay creates restoration through a three-part change of state: visual distance from the screen, a small physical relocation, and a bounded return. Its routes are assembled from the user's actual reachable environment and are varied enough to avoid becoming another rote desk ritual.

The return choice is a lightweight outcome signal, not a wellness assessment. It lets Relay distinguish a route that merely filled time from one that gave the user a believable reset, while respecting that break length and timing are voluntary.

## First Real Version

A mobile companion and minimal browser/desktop launcher could support a user-created map of three to six stations, 5/7/10-minute routes, audio or haptic prompts, and a one-tap return choice. The initial route library would cover visual reset, movement, hydration, and fresh-air variants, with every instruction designed to be completed without looking at a screen.

## Assumptions and Risks

This assumes the user has at least two safe, reachable places other than their desk and can take a break without needing to monitor urgent work. Small homes, shared offices, disability, caregiving, and weather can constrain movement, so stations must be adaptable—e.g., a chair facing away from the screen rather than stairs.

Novel prompts could feel patronizing or distracting if overdone; they should be sparse, editable, and quickly dismissible. “Ready to return” is only a proxy for restoration and should not be framed as health measurement. The product should never imply that it can solve excessive workload or an unsafe work culture.

## Evidence

The passed research reports that a five-minute break can feel too short for the brain to power off, while a nominal ten-minute Reddit break can expand to two hours. It also documents workers seeking screen-free micro-activities such as walking, looking out a window, stretching, getting water, meditation, and small household tasks, sometimes adding a separate return alarm. These accounts support designing for a physically distinct, bounded transition rather than another timer or on-screen activity. They do not establish that any single route improves recovery for everyone. Sources: [break-duration and scrolling account](https://www.reddit.com/r/productivity/comments/s94qhx), [tiny-break activities](https://www.reddit.com/r/productivity/comments/qdn9pu), and [screen-free activities plus return timer](https://www.reddit.com/r/productivity/comments/1d26oys).

## Red Team Validation

Decision: `pass`

A user can genuinely provide the only needed input: a few reachable places in their own home or office. At a self-chosen break, Relay then gets them physically away from the screen, directs a brief screen-free action, and provides a clear return boundary. That is an actual rest experience rather than a report or recommendation artifact.

The flow is credibly repeatable for workers who already take short desk breaks: routes can vary, timing remains voluntary, and the phone need not become a feed. It will not suit every space or circumstance, but the product acknowledges those limits and can work with modest, authentic stations such as a window, tap, or chair facing away from the desk.
