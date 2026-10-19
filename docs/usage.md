# Usage & control

The virtual headset can be controlled from the keyboard, a status bar, the
browser, or scripts. Under the hood everything goes through one of three
surfaces: the `virtual-headset-ctl` CLI, the D-Bus interface, or raw HID
reports.

- [Running it](#running-it)
- [Controls (interactive)](#controls-interactive)
- [virtual-headset-ctl](#virtual-headset-ctl)
- [D-Bus interface](#d-bus-interface)
- [HID control](#hid-control)
- [Examples](#examples)

## Running it

### As a service (NixOS)

The service starts automatically at login and comes up **muted**. Control it
with:

```bash
systemctl --user status virtual-headset
systemctl --user restart virtual-headset
```

On a non-interactive start (the service), it forwards your configured source, or
the PipeWire **default** source if none is set. After changing the default
source, restart the service so it picks up the new input — or set a specific one
with `virtual-headset-ctl set-source` (see [Status bar & desktop
panel](./status-bar.md)).

### Manually (interactive)

```bash
virtual-headset
# or, if built with cargo:
./target/release/virtual-headset
```

Then pick your real microphone, and in Zoom, Meet or Teams select
**Virtual_Headset_Microphone** as your input.

## Controls (interactive)

- **`m`** — toggle mute (sends the HID button event to apps)
- **`q`** / **`Esc`** — quit and clean up
- **`Ctrl+C`** — emergency quit

## virtual-headset-ctl

The `virtual-headset-ctl` utility provides convenient commands:

| Command                                          | Description                                            |
| ------------------------------------------------ | ------------------------------------------------------ |
| `mute` / `unmute` / `toggle-mute`                | Set mute state (via HID OUTPUT report — most reliable) |
| `mute-dbus` / `unmute-dbus` / `toggle-mute-dbus` | Same, via D-Bus                                        |
| `ptt-down` / `ptt-up`                            | Push-to-talk key down/up: hold to talk, tap to latch   |
| `ptt-press` / `ptt-release`                      | Backwards-compatible aliases for `ptt-down` / `ptt-up` |
| `get-source`                                     | Description of the source currently being forwarded    |
| `list-sources`                                   | Forwardable input sources as JSON (for pickers)        |
| `set-source <name>`                              | Forward a specific source (restarts the service)       |
| `clear-source`                                   | Go back to following the system default source         |
| `monitor-mute`                                   | Stream mute-state changes as JSON (for status bars)    |
| `restart-service`                                | Restart the systemd user service                       |
| `find-device`                                    | Print the hidraw device path                           |

## Foot pedal / push-to-talk

`ptt-down` and `ptt-up` are designed for a momentary foot pedal. The daemon owns
the press timing, so a daemon restart cannot leave a stale latch file behind:

- **hold longer than 300 ms** — unmute on press, mute on release;
- **tap shorter than 300 ms** — unmute and latch the mic open until the next
  press.

Bind both edges of the pedal key. For Hyprland:

```lua
hl.bind(
    "XF86AudioMicMute",
    hl.dsp.exec_cmd("virtual-headset-ctl ptt-down"),
    { description = "Push-to-talk down" }
)
hl.bind(
    "XF86AudioMicMute",
    hl.dsp.exec_cmd("virtual-headset-ctl ptt-up"),
    { release = true, description = "Push-to-talk up" }
)
```

> [!IMPORTANT]
> Linux maps the HID Telephony `Phone Mute` usage to `KEY_MICMUTE`. The virtual
> headset therefore also emits `XF86AudioMicMute` through the kernel input
> stack. If you leave an old system-mute binding on that key, it will mute the
> OS source (and can recurse into the PTT command). Remove the old binding or
> keep the virtual input device away from libinput:
>
> ```udev
> # /etc/udev/rules.d/99-virtual-headset.rules
> SUBSYSTEM=="input", ATTRS{name}=="Virtual_Headset", ENV{LIBINPUT_IGNORE_DEVICE}="1"
> ```
>
> Verify the name with `udevadm info -q property -n /dev/input/eventX`. Ignoring
> the input device does not affect Chrome/WebHID access to the hidraw device.

If you prefer to leave the virtual input device alone, bind the physical pedal by
keycode instead (for example `code:198` for F20) and do not bind
`XF86AudioMicMute` at all.

## D-Bus interface

- **Service**: `com.github.virtual_headset`
- **Object path**: `/com/github/virtual_headset`
- **Interface**: `com.github.virtual_headset.Mute`

**Methods**

- `IsMuted() -> bool` — query current mute state
- `Mute()` — mute if not already muted
- `Unmute()` — unmute if currently muted
- `Toggle()` — toggle the mute state
- `PttDown()` / `PttUp()` — push-to-talk press/release with tap-to-latch

**Signals**

- `MuteChanged(bool muted)` — emitted whenever the mute state changes

## HID control

The device accepts control commands via HID OUTPUT reports (report ID 3):

- Write `[0x03, 0x01]` to `/dev/hidraw*` to **mute**
- Write `[0x03, 0x02]` to `/dev/hidraw*` to **unmute**
- Write `[0x03, 0x03]` to `/dev/hidraw*` to **toggle**

The daemon receives these and sends INPUT reports to connected applications.

## Examples

**Toggle mute**

```bash
# Recommended — sends the HID OUTPUT report directly
virtual-headset-ctl toggle-mute

# Or manually to the hidraw device
echo -ne '\x03\x03' > /dev/hidraw0   # replace hidraw0 with your device
```

**Toggle via D-Bus**

```bash
virtual-headset-ctl toggle-mute-dbus

# Or directly with dbus-send
dbus-send --session --print-reply \
  --dest=com.github.virtual_headset \
  /com/github/virtual_headset \
  com.github.virtual_headset.Mute.Toggle
```

**Push-to-talk**

```bash
# Key down / key up, e.g. from a foot pedal binding
virtual-headset-ctl ptt-down
virtual-headset-ctl ptt-up

# Or directly over D-Bus
dbus-send --session \
  --dest=com.github.virtual_headset \
  /com/github/virtual_headset \
  com.github.virtual_headset.Mute.PttDown

dbus-send --session \
  --dest=com.github.virtual_headset \
  /com/github/virtual_headset \
  com.github.virtual_headset.Mute.PttUp
```

**Query current state**

```bash
dbus-send --session --print-reply \
  --dest=com.github.virtual_headset \
  /com/github/virtual_headset \
  com.github.virtual_headset.Mute.IsMuted
```

**Monitor for changes**

```bash
# JSON, suitable for status bars
virtual-headset-ctl monitor-mute

# Or directly with dbus-monitor
dbus-monitor --session \
  "type='signal',interface='com.github.virtual_headset.Mute',member='MuteChanged'"
```
