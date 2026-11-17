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
  player_name: string;
  ranking_name: string;
  created_by_email: string | null;
  reversed_by_email: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [activeSection, setActiveSection] = useState<'resultados' | 'jogadores' | 'historico'>('resultados');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyRanking, setHistoryRanking] = useState('');
  const [historyPlayer, setHistoryPlayer] = useState('');
  const [historyStatus, setHistoryStatus] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

      supabase.rpc('admin_results_history')
    ]);

    if (r.error || p.error || e.error) {
      throw new Error(r.error?.message || p.error?.message || e.error?.message || 'Erro ao consultar dados.');
    }

    const rankingData = (r.data || []) as Ranking[];

    setRankings(rankingData);
    setPlayers((p.data || []) as Player[]);
    setResults((e.data || []) as Result[]);
    if ((e.data || []).length >= 1000) {
      setMessage('Atenção: histórico com 1.000 ou mais registros. Será necessário adicionar paginação para consultar todos.');
    }

    setRanking(current =>
      rankingData.some(item => item.id === current)
        ? current
        : rankingData[0]?.id || ''
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !user) { router.replace('/login'); return; }
        const { data, error: adminError } = await supabase
          .from('administrators').select('user_id').eq('user_id', user.id).maybeSingle();
        if (cancelled) return;
        if (adminError || !data) { router.replace('/'); return; }
        setAuthorized(true);
        await load();
      } catch (error) {
        if (!cancelled) setMessage('Erro ao carregar painel: ' +
          (error instanceof Error ? error.message : 'Erro desconhecido'));
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void initialize();
    return () => { cancelled = true; };
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

    if (players.some(p => p.ranking_id === ranking && p.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      setMessage('Já existe um jogador com esse nome nesta categoria.');
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

  function startEditing(p: Player) {
    setEditingId(p.id);
    setEditingName(p.name);
    setMessage('');
  }

  async function renamePlayer(p: Player) {
    const name = editingName.trim();
    if (!name) {
      setMessage('Informe um nome válido.');
      return;
    }
    if (name === p.name) {
      setEditingId(null);
      return;
    }
    if (players.some(other =>
      other.id !== p.id &&
      other.ranking_id === p.ranking_id &&
      other.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR')
    )) {
      setMessage('Já existe um jogador com esse nome na categoria.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.from('players')
        .update({ name })
        .eq('id', p.id)
        .eq('ranking_id', p.ranking_id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Atualização não confirmada. Verifique suas permissões.');
      setEditingId(null);
      setMessage('Nome atualizado com sucesso!');
      await load();
    } catch (error) {
      setMessage('Erro ao editar jogador: ' +
        (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setBusy(false);
    }
  }

  async function togglePlayer(p: Player) {
    const action = p.active ? 'desativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} ${p.name}? Os resultados históricos serão preservados.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.from('players')
        .update({ active: !p.active })
        .eq('id', p.id)
        .eq('ranking_id', p.ranking_id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Alteração não confirmada. Verifique suas permissões.');
      if (p.active && player === p.id) setPlayer('');
      setMessage(p.active ? 'Jogador desativado com sucesso!' : 'Jogador reativado com sucesso!');
      await load();
    } catch (error) {
      setMessage('Erro ao alterar situação: ' +
        (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setBusy(false);
    }
  }

  const filteredResults = results.filter(result => {
    if (historyRanking && result.ranking_id !== historyRanking) return false;
    if (historyPlayer && result.player_id !== historyPlayer) return false;
    if (historyStatus === 'validos' && result.reversed_at) return false;
    if (historyStatus === 'estornados' && !result.reversed_at) return false;
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(result.created_at));
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });

  const validResults = filteredResults.filter(r => !r.reversed_at);
  const totals = validResults.reduce((acc, r) => {
    const rule = rankings.find(item => item.id === r.ranking_id);
    acc.wins += r.wins;
    acc.goals += r.goals;
    acc.assists += r.assists;
    acc.points += r.wins * Number(rule?.win_points ?? 0)
      + r.goals * Number(rule?.goal_points ?? 0)
      + r.assists * Number(rule?.assist_points ?? 0);
    return acc;
  }, { wins: 0, goals: 0, assists: 0, points: 0 });

  function exportHistory() {
    const columns = ['Data', 'Categoria', 'Jogador', 'Vitorias', 'Gols',
      'Assistencias', 'Situacao', 'Registrado por', 'Estornado em', 'Estornado por'];
    const quote = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [columns, ...filteredResults.map(r => [
      new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), r.ranking_name,
      r.player_name, r.wins, r.goals, r.assists,
      r.reversed_at ? 'ESTORNADO' : 'VALIDO',
      r.created_by_email || 'Nao identificado',
      r.reversed_at ? new Date(r.reversed_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
      r.reversed_by_email || ''
    ])].map(row => row.map(quote).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'brother-historico.csv';
    anchor.click();
    URL.revokeObjectURL(url);
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

      <div className="page-intro"><div className="eyebrow">CENTRAL ADMINISTRATIVA</div><h1>Painel de controle</h1>

      <p className="muted">
        Gerencie jogadores, registre resultados e consulte
        o histórico de lançamentos.
      </p></div>

      <section className="category-panel"><div className="eyebrow">CATEGORIA A SER EDITADA</div><div className="category-switch">{rankings.map(r => (<button key={r.id} type="button" className={ranking === r.id ? "category-choice selected" : "category-choice"} onClick={() => { setRanking(r.id); setPlayer(''); setEditingId(null); }}>{r.name.toLowerCase().includes("goleiro") ? "🧤 " : "⚽ "}{r.name.replace(/^BROTHER\s*/i, "")}</button>))}</div><p className="muted small">A categoria selecionada controla resultados e gerenciamento de jogadores.</p></section>

      <nav className="admin-nav" aria-label="Seções administrativas"><button className={activeSection === "resultados" ? "selected" : ""} onClick={() => setActiveSection("resultados")}>🏆 Resultados</button><button className={activeSection === "jogadores" ? "selected" : ""} onClick={() => setActiveSection("jogadores")}>👥 Jogadores</button><button className={activeSection === "historico" ? "selected" : ""} onClick={() => setActiveSection("historico")}>📋 Histórico</button></nav>

      {message && (
        <section className="panel" role="status">
          <p>{message}</p>
        </section>
      )}

      {activeSection === "resultados" && <section className="panel">
        <h2>🏆 Adicionar resultados</h2>

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

        {player && validValues && (() => {
          const current = results.filter(r => r.player_id === player && !r.reversed_at)
            .reduce((sum, r) => sum + r.wins * Number(currentRanking?.win_points ?? 0)
              + r.goals * Number(currentRanking?.goal_points ?? 0)
              + r.assists * Number(currentRanking?.assist_points ?? 0), 0);
          return <div className="score-preview" aria-live="polite">
            <div className="eyebrow">PRÉVIA DO LANÇAMENTO</div>
            <div className="preview-row"><div><span>Atual</span><strong>{current.toLocaleString('pt-BR')}</strong></div>
              <span className="preview-arrow">→</span><div><span>Após salvar</span><strong className="success">{(current + points).toLocaleString('pt-BR')}</strong></div></div>
            <p className="muted small">+{points.toLocaleString('pt-BR')} ponto(s) neste lançamento. Confirme antes de salvar.</p>
          </div>;
        })()}

        <p className="muted small">
          Critérios: {currentRanking?.win_points ?? 3} por vitória,
          {' '}{currentRanking?.goal_points ?? 1} por gol e
          {' '}{currentRanking?.assist_points ?? 0.5} por assistência.
        </p>

        <button
          className="primary"
          disabled={busy || !player || !validValues || [wins, goals, assists].every(v => Number(v) === 0)}
          onClick={save}
        >
          {busy ? 'Processando...' : 'Salvar resultado'}
        </button>
      </section>}

      {activeSection === "jogadores" && <section className="panel">
        <h2>👥 Cadastrar jogador</h2>

        <label>Nome do jogador</label>

        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome completo ou apelido"
          maxLength={100}
        />

        <p className="muted small">
          Categoria: {currentRanking?.name.replace(/^BROTHER\s*/i, '') || 'Nenhuma'}
        </p>

        <button
          disabled={busy || !newName.trim() || !ranking}
          onClick={addPlayer}
        >
          Cadastrar jogador
        </button>
      </section>}

      {activeSection === "jogadores" && <section className="panel">
        <h2>⚙️ Gerenciar jogadores</h2>
        <p className="muted small">
          Categoria: {currentRanking?.name.replace(/^BROTHER\s*/i, '') || 'Nenhuma'}. Alterações de nome
          preservam os resultados. Jogadores inativos não podem receber novos lançamentos.
        </p>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />{' '}Mostrar jogadores inativos
        </label>
        {players.filter(p => p.ranking_id === ranking && (showInactive || p.active))
          .map(p => (
            <div className="history line" key={p.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === p.id ? (
                  <input
                    value={editingName}
                    maxLength={100}
                    onChange={e => setEditingName(e.target.value)}
                    aria-label={`Novo nome de ${p.name}`}
                  />
                ) : (
                  <strong>{p.name}</strong>
                )}
                <div className="muted small">
                  {p.active ? 'Ativo' : 'Inativo'}
                </div>
              </div>
              <div className="line" style={{ flexWrap: 'wrap' }}>
                {editingId === p.id ? (
                  <>
                    <button disabled={busy || !editingName.trim()} onClick={() => renamePlayer(p)}>
                      Salvar nome
                    </button>
                    <button disabled={busy} onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button disabled={busy || editingId !== null} onClick={() => startEditing(p)}>
                    Editar nome
                  </button>
                )}
                <button
                  className={p.active ? 'danger' : ''}
                  disabled={busy || editingId !== null}
                  onClick={() => togglePlayer(p)}
                >
                  {p.active ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          ))}
      </section>}

      {activeSection === "historico" && <section className="panel">
        <h2>📋 Histórico administrativo</h2>
        <p className="muted small">Consulte lançamentos, responsáveis e estornos. O resumo considera somente registros válidos.</p>
        <div className="grid">
          <div>
            <label>Categoria</label>
            <select value={historyRanking} onChange={e => { setHistoryRanking(e.target.value); setHistoryPlayer(''); }}>
              <option value="">Todas</option>
              {rankings.map(r => <option key={r.id} value={r.id}>{r.name.replace(/^BROTHER\s*/i, "")}</option>)}
            </select>
          </div>
          <div>
            <label>Jogador</label>
            <select value={historyPlayer} onChange={e => setHistoryPlayer(e.target.value)}>
              <option value="">Todos</option>
              {players.filter(p => !historyRanking || p.ranking_id === historyRanking)
                .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label>Situação</label>
            <select value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="validos">Válidos</option>
              <option value="estornados">Estornados</option>
            </select>
          </div>
        </div>
        <div className="grid">
          <div><label>Data inicial (Brasília)</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><label>Data final (Brasília)</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
        </div>
        <p><strong>{filteredResults.length} lançamento(s) encontrado(s)</strong></p>
        <p className="muted small">
          Total válido: {totals.wins} vitórias · {totals.goals} gols · {totals.assists} assistências · {' '}
          {totals.points.toLocaleString('pt-BR')} pontos
        </p>
        <button onClick={exportHistory} disabled={filteredResults.length === 0}>Exportar CSV para Excel</button>
        {filteredResults.length === 0 && <p className="muted">Nenhum lançamento encontrado.</p>}
        {filteredResults.map(result => {
          const reversed = Boolean(result.reversed_at);
          return (
            <div className="history line" key={result.id}>
              <div>
                <strong>{result.player_name}</strong>
                <div className="muted small">{result.ranking_name.replace(/^BROTHER\s*/i, '')}</div>
                <div className="muted small">
                  {new Date(result.created_at).toLocaleString('pt-BR')} · {' '}
                  {result.wins} V / {result.goals} G / {result.assists} A
                </div>
                <div className="muted small">Registrado por: {result.created_by_email || 'Não identificado'}</div>
                <div className="muted small">Situação: {reversed ? 'ESTORNADO' : 'VÁLIDO'}</div>
                {reversed && <div className="muted small">
                  Estornado em {new Date(result.reversed_at!).toLocaleString('pt-BR')}
                  {' · '}Por: {result.reversed_by_email || 'Não identificado'}
                </div>}
              </div>
              <button
                className={reversed ? '' : 'danger'}
                disabled={busy || reversed}
                onClick={() => undo(result.id)}
              >{reversed ? 'Estornado' : 'Estornar'}</button>
            </div>
          );
        })}
      </section>}
    </main>
  );
}
