import { Component, type ErrorInfo, type ReactNode } from 'react';

/* Satu error waktu render bikin React ngosongin SELURUH layar — di tengah
   sesi artinya obrolannya ilang gitu aja tanpa penjelasan. Ini nangkep
   error-nya, nunjukin apa yang salah, dan ngasih jalan keluar.
   Harus class component: React belum punya versi hook-nya. */
export class Boom extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Zii Talk kepentok error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="boom">
        <div className="boom-card">
          <h1>Aduh, ada yang error</h1>
          <p>
            Bagian ini berhenti di tengah jalan. Yang udah kesimpan di server — frasa, riwayat sesi, momentum —
            aman.
          </p>
          <pre>{error.message || String(error)}</pre>
          <div className="boom-acts">
            <button className="btn primary" onClick={() => location.reload()}>
              Muat ulang
            </button>
            <button className="btn ghost" onClick={() => this.setState({ error: null })}>
              Coba lanjut
            </button>
          </div>
        </div>
      </div>
    );
  }
}
