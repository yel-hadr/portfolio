---
title: tmux keeps remote work alive when SSH drops
summary: Work on a server inside a named tmux session. If the connection drops, the shell and its running commands survive, and tmux attach brings them back. A few default key bindings cover daily use.
description: Run server work in a named tmux session: if SSH drops, the shell and its commands survive, and tmux attach brings them back. Plus the daily key bindings.
---

## The problem

You start a long migration, a backup or a package upgrade over SSH. The Wi-Fi blinks, the laptop sleeps or the VPN reconnects, and the SSH session ends. So does the command: it was a child of your login shell, and that shell went away with the connection. Now you have to work out how far it got.

## Why it happens

When an SSH connection closes, the remote login shell receives a hangup signal (`SIGHUP`) and exits, and the jobs it started normally end with it. Everything you ran was tied to that one connection.

tmux breaks that tie. It runs a server process on the remote machine that owns your shells. Your SSH session only runs a tmux *client*, which displays a session and sends it your keystrokes. When the connection drops, the client goes away, but the tmux server, the session, its shells and their running commands keep going.

## The fix

Do server work inside a named session, and reattach after a disconnect:

```shell
tmux new -s deploy      # start a named session
tmux attach -t deploy   # reattach after the SSH connection drops
tmux ls                 # list sessions

# Default bindings, pressed after the prefix (Ctrl-b):
#   d  detach                %  split left / right
#   "  split top / bottom    z  zoom the current pane
#   [  scroll (copy mode)    s  switch session
#   :setw synchronize-panes on  -> type into every pane at once
```

A few notes on daily use:

- **One command for both cases.** `tmux new -A -s deploy` attaches to `deploy` if it exists and creates it otherwise, which makes it a handy alias.
- **Detach on purpose.** `Ctrl-b` then `d` leaves everything running; you can log out and come back later, from another machine too.
- **Scrolling.** Your terminal's scrollback does not see tmux's history. `Ctrl-b` then `[` enters copy mode, where the arrow keys and Page Up scroll; `q` leaves it.
- **Several servers at once.** In a split window, `synchronize-panes` sends the same keystrokes to every pane. Turn it off again with `:setw synchronize-panes off`.
- **Forgot a binding?** `Ctrl-b` then `?` lists them all.

## Limits

tmux protects against a lost connection, not a lost machine: a reboot of the server ends the tmux server and everything in it. For work that must survive that, use a proper service or job scheduler.

## Takeaway

Make `tmux new -A -s <name>` the first thing you run on a server before any long task. A dropped connection then costs a reattach instead of a restarted job.
