all updates for ezz bot will be pushed here

## Events

Event tickets let a team of players sign up together. They use a normal ticket category, so the Discord category, staff roles, opening message and questions are all set from the dashboard like any other category.

1. Create a category for the event in the dashboard (for example `Events`).
2. Optionally run `/event category category:Events event-only:true` so it stays out of `/new` and normal panels.
3. Give your staff access with `/event roles add role:@Event Manager` (admins, and any role named "Event Manager", can always run events).
4. In the event channel, run `/event panel category:Events title:Puzzle Night team-size:4`.

Players press the button, pick their teammates from a member picker (or press **Play solo**), and get a private ticket named after the team and event, e.g. `frozedy-alex-puzzles`. Teammates are added to the channel automatically and players can't sign up twice for the same event.

To customise channel names, use `{team}` and `{event}` in the category's channel name, e.g. `{event}-{team}`.

`/event roles list` shows the current event manager roles and event-only categories.
