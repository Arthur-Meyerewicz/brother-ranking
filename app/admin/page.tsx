
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

type Ranking = {
  id: string;
  name: string;
  win_points: number;
  goal_points: number;
  assist_points: number;
};

type Player = {
  id: string;
  name: string;
  ranking_id: string;
  active: boolean;
};

type Result = {
  id: string;
  ranking_id: string;
  player_id: string;
  wins: number;
  goals: number;
  assists: number;
  created_at: string;
  created_by: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
};

export default function Admin() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  const [ranking, setRanking] = useState('');
  const [player, setPlayer] = useState('');

  const [wins, setWins] = useState('0');
  const [goals, setGoals] = useState('0');
  const [assists, setAssists] = useState('0');

  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, p, e] = await Promise.all([
      supabase
        .from('rankings')
        .select('*')
        .order('name'),

      supabase
        .from('players')
        .select('*')
        .order('name'),

      supabase
        .from('results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    if (r.error || p.error || e.error) {
      setMessage(
        'Erro ao consultar dados: ' +
        (r.error?.message ||
          p.error?.message ||
          e.error?.message)
      );
      return;
    }

    const rankingData = (r.data || []) as Ranking[];

    setRankings(rankingData);
    setPlayers((p.data || []) as Player[]);
    setResults((e.data || []) as Result[]);

    setRanking(current =>
      rankingData.some(item => item.id === current)
        ? current
        : rankingData[0]?.id || ''
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const { data: { user }, error } =
        await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !user) {
        router.replace('/login');
        return;
      }

      const { data, error: adminError } = await supabase
        .from('administrators')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (adminError || !data) {
        router.replace('/');
        return;
      }

      setAuthorized(true);
      setChecking(false);
      await load();
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [router, load]);

  const currentRanking = rankings.find(
    r => r.id === ranking
  );

  const rankingPlayers = players.filter(
    p => p.ranking_id === ranking && p.active
  );

  const validValues = [wins, goals, assists].every(
    value =>
      value.trim() !== '' &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) >= 0
  );

  const points = validValues
    ? Number(wins) * Number(currentRanking?.win_points ?? 0) +
      Number(goals) * Number(currentRanking?.goal_points ?? 0) +
      Number(assists) * Number(currentRanking?.assist_points ?? 0)
    : NaN;

  async function save() {
    const values = [wins, goals, assists].map(Number);

    if (
      !player ||
      !rankingPlayers.some(p => p.id === player) ||
      !validValues ||
      values.every(v => v === 0)
    ) {
      setMessage(
        'Selecione um jogador e informe quantidades inteiras válidas.'
      );
      return;
    }

    if (!window.confirm(
      `Confirmar lançamento de ${values[0]} vitória(s), ` +
      `${values[1]} gol(s) e ${values[2]} assistência(s)?`
    )) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase.rpc('add_result', {
        p_player_id: player,
        p_wins: values[0],
        p_goals: values[1],
        p_assists: values[2]
      });

      if (error) throw error;

      setWins('0');
      setGoals('0');
      setAssists('0');

      setMessage('Resultado registrado com sucesso!');
      await load();
    } catch (error) {
      setMessage(
        'Erro ao registrar resultado: ' +
        (error instanceof Error ? error.message : 'Erro desconhecido')
      );
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer() {
    const name = newName.trim();

    if (!name || !ranking) {
      setMessage('Informe o nome e selecione uma categoria.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('players')
        .insert({
          name,
          ranking_id: ranking,
          active: true
        });

      if (error) throw error;

      setNewName('');
      setMessage('Jogador cadastrado com sucesso!');
      await load();
    } catch (error) {
      setMessage(
        'Erro ao cadastrar jogador: ' +
        (error instanceof Error ? error.message : 'Erro desconhecido')
      );
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: string) {
    const result = results.find(r => r.id === id);

    if (!result || result.reversed_at) return;

    const playerName =
      players.find(p => p.id === result.player_id)?.name ||
      'Jogador';

    if (!window.confirm(
      `Deseja estornar o lançamento de ${playerName}?\n\n` +
      `${result.wins} vitória(s)\n` +
      `${result.goals} gol(s)\n` +
      `${result.assists} assistência(s)\n\n` +
      'O registro permanecerá no histórico de auditoria.'
    )) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase.rpc(
        'reverse_result',
        { p_result_id: id }
      );

      if (error) throw error;

      setMessage('Lançamento estornado com sucesso!');
      await load();
    } catch (error) {
      setMessage(
        'Erro ao estornar: ' +
        (error instanceof Error ? error.message : 'Erro desconhecido')
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (checking || !authorized) {
    return (
      <main className="wrap">
        <p className="muted">Verificando permissão...</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="header">
        <div className="logo">
          ⚽ BROTHER <span>Admin</span>
        </div>

        <div className="line">
          <Link href="/">Ranking público</Link>
          <button onClick={logout}>Sair</button>
        </div>
      </header>

      <h1>Painel administrativo</h1>

      <p className="muted">
        Gerencie jogadores, registre resultados e consulte
        o histórico de lançamentos.
      </p>

      {message && (
        <section className="panel">
          <p>{message}</p>
        </section>
      )}

      <section className="panel">
        <h2>🏆 Adicionar resultados</h2>

        <label>Categoria</label>

        <select
          value={ranking}
          onChange={e => {
            setRanking(e.target.value);
            setPlayer('');
          }}
        >
          {rankings.map(r => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <label>Jogador</label>

        <select
          value={player}
          onChange={e => setPlayer(e.target.value)}
        >
          <option value="">Selecione um jogador</option>

          {rankingPlayers.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="grid">
          <div>
            <label>Vitórias</label>
            <input
              type="number"
              min="0"
              step="1"
              value={wins}
              onChange={e => setWins(e.target.value)}
            />
          </div>

          <div>
            <label>Gols</label>
            <input
              type="number"
              min="0"
              step="1"
              value={goals}
              onChange={e => setGoals(e.target.value)}
            />
          </div>

          <div>
            <label>Assistências</label>
            <input
              type="number"
              min="0"
              step="1"
              value={assists}
              onChange={e => setAssists(e.target.value)}
            />
          </div>
        </div>

        <p>
          <strong>
            Pontos adicionados:{' '}
            {Number.isFinite(points)
              ? points.toLocaleString('pt-BR')
              : '—'}
          </strong>
        </p>

        <p className="muted small">
          Critérios: {currentRanking?.win_points ?? 3} por vitória,
          {' '}{currentRanking?.goal_points ?? 1} por gol e
          {' '}{currentRanking?.assist_points ?? 0.5} por assistência.
        </p>

        <button
          className="primary"
          disabled={busy || !player || !validValues}
          onClick={save}
        >
          {busy ? 'Processando...' : 'Salvar resultado'}
        </button>
      </section>

      <section className="panel">
        <h2>👥 Cadastrar jogador</h2>

        <label>Nome do jogador</label>

        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome completo ou apelido"
          maxLength={100}
        />

        <p className="muted small">
          Categoria: {currentRanking?.name || 'Nenhuma'}
        </p>

        <button
          disabled={busy || !newName.trim() || !ranking}
          onClick={addPlayer}
        >
          Cadastrar jogador
        </button>
      </section>

      <section className="panel">
        <h2>📋 Últimos lançamentos</h2>

        {results.length === 0 && (
          <p className="muted">
            Nenhum lançamento encontrado.
          </p>
        )}

        {results.map(result => {
          const playerName =
            players.find(p => p.id === result.player_id)?.name ||
            'Jogador';

          const rankingName =
            rankings.find(r => r.id === result.ranking_id)?.name ||
            'Ranking';

          const reversed = Boolean(result.reversed_at);

          return (
            <div className="history line" key={result.id}>
              <div>
                <strong>{playerName}</strong>

                <div className="muted small">
                  {rankingName}
                </div>

                <div className="muted small">
                  {new Date(result.created_at).toLocaleString('pt-BR')}
                  {' · '}
                  {result.wins} V /
                  {' '}{result.goals} G /
                  {' '}{result.assists} A
                </div>

                {reversed && (
                  <div className="muted small">
                    Estornado em{' '}
                    {new Date(result.reversed_at!).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>

              <button
                className={reversed ? '' : 'danger'}
                disabled={busy || reversed}
                onClick={() => undo(result.id)}
              >
                {reversed ? 'Estornado' : 'Estornar'}
              </button>
            </div>
          );
        })}
      </section>
    </main>
  );
}
