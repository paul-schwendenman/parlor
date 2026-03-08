type ConnectionStatus = 'disconnected' | 'connected' | 'reconnecting' | 'error';

class ConnectionState {
  status = $state<ConnectionStatus>('disconnected');
  errorMessage = $state<string | null>(null);

  setConnected() {
    this.status = 'connected';
    this.errorMessage = null;
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
