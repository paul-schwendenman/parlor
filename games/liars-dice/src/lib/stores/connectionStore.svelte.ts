type ConnectionStatus = 'disconnected' | 'connected' | 'reconnecting' | 'error';

class ConnectionState {
  status = $state<ConnectionStatus>('disconnected');
  errorMessage = $state<string | null>(null);
  /** True while a `player:reconnect` handshake is in flight. */
  reconnectPending = $state(false);
  /** Transient per-action failure (ack timeout / server reject). */
  actionError = $state<string | null>(null);

  setConnected() {
    this.status = 'connected';
    this.errorMessage = null;
  }

  setReconnectPending(pending: boolean) {
    this.reconnectPending = pending;
  }

  setActionError(message: string | null) {
    this.actionError = message;
  }

  setDisconnected() {
    this.status = 'disconnected';
  }

  setReconnecting() {
    this.status = 'reconnecting';
  }

  setError(message: string) {
    this.status = 'error';
    this.errorMessage = message;
  }
}

export const connectionState = new ConnectionState();
