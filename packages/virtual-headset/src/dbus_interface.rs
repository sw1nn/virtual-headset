use crate::Command;
use crossbeam_channel::Sender;
use std::sync::{Arc, Mutex};
use zbus::{SignalContext, blocking::Connection, interface};

/// Shared mute state accessible from D-Bus interface
#[derive(Clone)]
pub struct MuteState {
    inner: Arc<Mutex<bool>>,
}

impl MuteState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(false)),
        }
    }

    pub fn set(&self, muted: bool) {
        *self.inner.lock().unwrap() = muted;
    }

    pub fn get(&self) -> bool {
        *self.inner.lock().unwrap()
    }
}

/// D-Bus interface for virtual headset mute control
pub struct VirtualHeadset {
    state: MuteState,
    command_tx: Sender<Command>,
}

#[interface(name = "com.github.virtual_headset.Mute")]
impl VirtualHeadset {
    /// Get current mute state
    fn is_muted(&self) -> bool {
        self.state.get()
    }

    /// Toggle mute state
    fn toggle(&self) -> zbus::fdo::Result<()> {
        self.send(Command::Toggle)
    }

    /// Set mute state to muted
    fn mute(&self) -> zbus::fdo::Result<()> {
        self.send(Command::Mute)
    }

    /// Set mute state to unmuted
    fn unmute(&self) -> zbus::fdo::Result<()> {
        self.send(Command::Unmute)
    }

    /// Push-to-talk key down: unmute, or mute if a previous tap latched the mic
    /// open.
    fn ptt_down(&self) -> zbus::fdo::Result<()> {
        self.send(Command::PttDown)
    }

    /// Push-to-talk key up: mute after a hold, or latch after a short tap.
    fn ptt_up(&self) -> zbus::fdo::Result<()> {
        self.send(Command::PttUp)
    }

    /// Signal emitted when mute state changes
    #[zbus(signal)]
    async fn mute_changed(signal_ctxt: &SignalContext<'_>, muted: bool) -> zbus::Result<()>;
}

impl VirtualHeadset {
    pub fn new(state: MuteState, command_tx: Sender<Command>) -> Self {
        Self { state, command_tx }
    }
}

impl VirtualHeadset {
    fn send(&self, command: Command) -> zbus::fdo::Result<()> {
        self.command_tx.send(command).map_err(|e| {
            zbus::fdo::Error::Failed(format!("Failed to send {command:?} command: {e}"))
        })
    }
}

/// D-Bus connection wrapper
pub struct DBusService {
    connection: Connection,
    state: MuteState,
}

impl DBusService {
    /// Initialize D-Bus service on session bus
    pub fn new(command_tx: Sender<Command>) -> Result<Self, Box<dyn std::error::Error>> {
        let state = MuteState::new();
        let connection = Connection::session()?;

        let interface = VirtualHeadset::new(state.clone(), command_tx);
        connection
            .object_server()
            .at("/com/github/virtual_headset", interface)?;

        connection.request_name("com.github.virtual_headset")?;

        Ok(Self { connection, state })
    }

    /// Get the shared mute state
    pub fn state(&self) -> MuteState {
        self.state.clone()
    }

    /// Send mute changed signal
    pub fn notify_mute_changed(&self, muted: bool) -> Result<(), Box<dyn std::error::Error>> {
        let object_server = self.connection.object_server();
        let iface_ref =
            object_server.interface::<_, VirtualHeadset>("/com/github/virtual_headset")?;

        // Use blocking runtime to send signal
        zbus::block_on(async {
            VirtualHeadset::mute_changed(iface_ref.signal_context(), muted).await
        })?;

        Ok(())
    }
}
