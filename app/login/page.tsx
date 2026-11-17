'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(), password
      });
      if (authError) throw authError;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Não foi possível verificar a sessão.');
      const { data, error: adminError } = await supabase
        .from('administrators').select('user_id').eq('user_id', user.id).maybeSingle();
      if (adminError || !data) {
        await supabase.auth.signOut();
        setError('Esta conta não possui permissão administrativa.');
        return;
      }
      router.replace('/admin');
    } catch {
      setError('Não foi possível entrar. Confira o e-mail e a senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <header className="header">
        <div className="logo"><span className="brand-mark">⚽</span> BROTHER <span>RANKING</span></div>
        <Link className="login-back" href="/">← Voltar ao ranking</Link>
      </header>
      <div className="login-shell">
        <section className="panel login-card">
          <div className="login-icon" aria-hidden="true">🔐</div>
          <div className="eyebrow">ÁREA RESTRITA</div>
          <h1>Acesso administrativo</h1>
          <p className="muted">Entre com sua conta autorizada para gerenciar jogadores, resultados e histórico.</p>
          <form onSubmit={login}>
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" type="email" autoComplete="username" value={email}
              onChange={event => setEmail(event.target.value)} placeholder="seu@email.com" required />
            <label htmlFor="login-password">Senha</label>
            <input id="login-password" type="password" autoComplete="current-password"
              value={password} onChange={event => setPassword(event.target.value)} required />
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Verificando acesso...' : 'Entrar no painel'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
