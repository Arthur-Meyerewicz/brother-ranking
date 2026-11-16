
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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

type HistoryResult = {
  id: string;
  ranking_id: string;
  player_id: string;
  player_name: string;
  ranking_name: string;
  wins: number;
  goals: number;
  assists: number;
  created_at: string;
  created_by: string | null;
  created_by_email: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversed_by_email: string | null;
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Erro desconhecido';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo'
  });
}

function formatPoints(value: number): string {
  return value.toLocaleString('pt-BR', {
    maximumFractionDigits: 2
  });
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');

  // Evita interpretação de fórmulas pelo Excel.
  if (/^[\s]*[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }

  return '"' + text.replace(/"/g, '""') + '"';
}

export default function Admin() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<HistoryResult[]>([]);

  const [ranking, setRanking] = useState('');
  const [player, setPlayer] = useState('');

  const [wins, setWins] = useState('0');
  const [goals, setGoals] = useState('0');
  const [assists, setAssists] = useState('0');

  const [newName, setNewName] = useState('');

  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [historyRanking, setHistoryRanking] = useState('');
  const [historyPlayer, setHistoryPlayer] = useState('');
  const [historyStatus, setHistoryStatus] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    const [rankingResponse, playerResponse, historyResponse] =
      await Promise.all([
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

    const error =
      rankingResponse.error ||
      playerResponse.error ||
      historyResponse.error;

    if (error) {
      throw new Error(error.message);
    }

    const rankingData =
      (rankingResponse.data || []) as Ranking[];

    setRankings(rankingData);
    setPlayers((playerResponse.data || []) as Player[]);
    setResults((historyResponse.data || []) as HistoryResult[]);

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
        await load();
      } catch (error) {
        if (!cancelled) {
          setMessage(
            'Erro ao carregar painel: ' + errorMessage(error)
          );
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [router, load]);

  const currentRanking = rankings.find(
    item => item.id === ranking
  );

  const rankingPlayers = players.filter(
    item => item.ranking_id === ranking && item.active
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

  const filteredResults = useMemo(() => {
    return results.filter(result => {
      if (
        historyRanking &&
        result.ranking_id !== historyRanking
      ) {
        return false;
      }

      if (
        historyPlayer &&
        result.player_id !== historyPlayer
      ) {
        return false;
      }

      if (
        historyStatus === 'validos' &&
        result.reversed_at !== null
      ) {
        return false;
      }

      if (
        historyStatus === 'estornados' &&
        result.reversed_at === null
      ) {
        return false;
      }

      // As datas são interpretadas no fuso de Brasília.
      const timestamp = new Date(result.created_at).getTime();

      if (dateFrom) {
        const start = new Date(
          `${dateFrom}T00:00:00-03:00`
        ).getTime();

        if (timestamp < start) return false;
      }

      if (dateTo) {
        const end = new Date(
          `${dateTo}T23:59:59.999-03:00`
        ).getTime();

        if (timestamp > end) return false;
      }

      return true;
    });
  }, [
    results,
    historyRanking,
    historyPlayer,
    historyStatus,
    dateFrom,
    dateTo
  ]);

  const totals = useMemo(() => {
    return filteredResults.reduce(
      (acc, result) => {
        if (result.reversed_at) return acc;

        const rankingData = rankings.find(
          item => item.id === result.ranking_id
        );

        acc.wins += result.wins;
        acc.goals += result.goals;
        acc.assists += result.assists;

        acc.points +=
          result.wins * Number(rankingData?.win_points ?? 0) +
          result.goals * Number(rankingData?.goal_points ?? 0) +
          result.assists * Number(rankingData?.assist_points ?? 0);

        return acc;
      },
      {
        wins: 0,
        goals: 0,
        assists: 0,
        points: 0
      }
    );
  }, [filteredResults, rankings]);

  async function refresh() {
    try {
      await load();
    } catch (error) {
      setMessage(
        'Erro ao atualizar dados: ' + errorMessage(error)
      );
    }
  }

  async function save() {
    const values = [wins, goals, assists].map(Number);

    if (
      !player ||
      !rankingPlayers.some(item => item.id === player) ||
      !validValues ||
      values.every(value => value === 0)
    ) {
      setMessage(
        'Selecione um jogador e informe quantidades inteiras válidas.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirmar lançamento?\n\n` +
      `Vitórias: ${values[0]}\n` +
      `Gols: ${values[1]}\n` +
      `Assistências: ${values[2]}\n` +
      `Pontos: ${formatPoints(points)}`
    );

    if (!confirmed) return;

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

      await refresh();
      setMessage('Resultado registrado com sucesso!');
    } catch (error) {
      setMessage(
        'Erro ao registrar resultado: ' + errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer() {
    const name = newName.trim();

    if (!name || !ranking) {
      setMessage(
        'Informe o nome e selecione uma categoria.'
      );
      return;
    }

    const duplicate = players.some(
      item =>
        item.ranking_id === ranking &&
        item.name.toLocaleLowerCase('pt-BR') ===
          name.toLocaleLowerCase('pt-BR')
    );

    if (duplicate) {
      setMessage(
        'Já existe um jogador com esse nome nesta categoria.'
      );
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
      await refresh();
      setMessage('Jogador cadastrado com sucesso!');
    } catch (error) {
      setMessage(
        'Erro ao cadastrar jogador: ' + errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  function startEditing(item: Player) {
    setEditingId(item.id);
    setEditingName(item.name);
    setMessage('');
  }

  async function renamePlayer(item: Player) {
    const name = editingName.trim();

    if (!name) {
      setMessage('O nome do jogador não pode ficar vazio.');
      return;
    }

    if (name === item.name) {
      setEditingId(null);
      return;
    }

    const duplicate = players.some(
      other =>
        other.id !== item.id &&
        other.ranking_id === item.ranking_id &&
        other.name.toLocaleLowerCase('pt-BR') ===
          name.toLocaleLowerCase('pt-BR')
    );

    if (duplicate) {
      setMessage(
        'Já existe outro jogador com esse nome nesta categoria.'
      );
      return;
    }

    if (!window.confirm(
      `Alterar o nome de "${item.name}" para "${name}"?`
    )) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('players')
        .update({ name })
        .eq('id', item.id)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Jogador não atualizado.');

      setEditingId(null);
      setEditingName('');

      await refresh();
      setMessage('Nome atualizado com sucesso!');
    } catch (error) {
      setMessage(
        'Erro ao editar jogador: ' + errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePlayer(item: Player) {
    const nextActive = !item.active;

    const confirmed = window.confirm(
      nextActive
        ? `Reativar o jogador "${item.name}"?`
        : `Desativar "${item.name}"?\n\n` +
          'O histórico e a pontuação serão preservados.'
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('players')
        .update({ active: nextActive })
        .eq('id', item.id)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Jogador não atualizado.');

      if (!nextActive && player === item.id) {
        setPlayer('');
      }

      await refresh();

      setMessage(
        nextActive
          ? 'Jogador reativado com sucesso!'
          : 'Jogador desativado com sucesso!'
      );
    } catch (error) {
      setMessage(
        'Erro ao alterar situação: ' + errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: string) {
    const result = results.find(item => item.id === id);

    if (!result || result.reversed_at) return;

    const confirmed = window.confirm(
      `Estornar o lançamento de ${result.player_name}?\n\n` +
      `${result.wins} vitória(s)\n` +
      `${result.goals} gol(s)\n` +
      `${result.assists} assistência(s)\n\n` +
      'O registro permanecerá no histórico.'
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase.rpc(
        'reverse_result',
        { p_result_id: id }
      );

      if (error) throw error;

      await refresh();
      setMessage('Lançamento estornado com sucesso!');
    } catch (error) {
      setMessage(
        'Erro ao estornar: ' + errorMessage(error)
      );
    } finally {
      setBusy(false);
    }
  }

  function exportHistory() {
    if (filteredResults.length === 0) return;

    const headers = [
      'ID',
      'Categoria',
      'Jogador',
      'Vitórias',
      'Gols',
      'Assistências',
      'Pontos',
      'Data do lançamento',
      'Registrado por',
      'Situação',
      'Data do estorno',
      'Estornado por'
    ];

    const rows = filteredResults.map(result => {
      const rankingData = rankings.find(
        item => item.id === result.ranking_id
      );

      const pointsValue = result.reversed_at
        ? 0
        : result.wins * Number(rankingData?.win_points ?? 0) +
          result.goals * Number(rankingData?.goal_points ?? 0) +
          result.assists * Number(rankingData?.assist_points ?? 0);

      return [
        result.id,
        result.ranking_name,
        result.player_name,
        result.wins,
        result.goals,
        result.assists,
        formatPoints(pointsValue),
        formatDate(result.created_at),
        result.created_by_email || 'Não identificado',
        result.reversed_at ? 'ESTORNADO' : 'VÁLIDO',
        result.reversed_at
          ? formatDate(result.reversed_at)
          : '',
        result.reversed_by_email || ''
      ];
    });

    const content = [headers, ...rows]
      .map(row => row.map(csvCell).join(';'))
      .join('\r\n');

    const blob = new Blob(
      ['\uFEFF' + content],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'brother-ranking-historico.csv';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setHistoryRanking('');
    setHistoryPlayer('');
    setHistoryStatus('todos');
    setDateFrom('');
    setDateTo('');
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (checking) {
    return (
      <main className="wrap">
        <p className="muted">Verificando permissão...</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="wrap">
        <p>Não foi possível carregar o painel.</p>
        {message && <p className="muted">{message}</p>}
        <Link href="/login">Voltar ao login</Link>
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
            setEditingId(null);
          }}
        >
          {rankings.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <label>Jogador</label>
        <select
          value={player}
          onChange={e => setPlayer(e.target.value)}
        >
          <option value="">Selecione um jogador</option>
          {rankingPlayers.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
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
              ? formatPoints(points)
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
        <h2>⚙️ Gerenciar jogadores</h2>

        <p className="muted small">
          Edite nomes, desative ou reative jogadores.
          O histórico de resultados será preservado.
        </p>

        <label>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />{' '}
          Mostrar jogadores inativos
        </label>

        {players
          .filter(
            item =>
              item.ranking_id === ranking &&
              (showInactive || item.active)
          )
          .map(item => (
            <div className="history line" key={item.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === item.id ? (
                  <input
                    value={editingName}
                    maxLength={100}
                    onChange={e => setEditingName(e.target.value)}
                    aria-label={`Novo nome de ${item.name}`}
                  />
                ) : (
                  <strong>{item.name}</strong>
                )}

                <div className="muted small">
                  {item.active ? 'Ativo' : 'Inativo'}
                </div>
              </div>

              <div
                className="line"
                style={{ flexWrap: 'wrap' }}
              >
                {editingId === item.id ? (
                  <>
                    <button
                      disabled={busy || !editingName.trim()}
                      onClick={() => renamePlayer(item)}
                    >
                      Salvar nome
                    </button>

                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditingId(null);
                        setEditingName('');
                      }}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    disabled={busy || editingId !== null}
                    onClick={() => startEditing(item)}
                  >
                    Editar nome
                  </button>
                )}

                <button
                  className={item.active ? 'danger' : ''}
                  disabled={busy || editingId !== null}
                  onClick={() => togglePlayer(item)}
                >
                  {item.active ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          ))}
      </section>

      <section className="panel">
        <h2>📋 Histórico administrativo</h2>

        <p className="muted small">
          Consulte lançamentos, responsáveis e estornos.
          O resumo considera somente registros válidos.
        </p>

        <div className="grid">
          <div>
            <label>Categoria</label>
            <select
              value={historyRanking}
              onChange={e => {
                setHistoryRanking(e.target.value);
                setHistoryPlayer('');
              }}
            >
              <option value="">Todas</option>
              {rankings.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Jogador</label>
            <select
              value={historyPlayer}
              onChange={e => setHistoryPlayer(e.target.value)}
            >
              <option value="">Todos</option>
              {players
                .filter(
                  item =>
                    !historyRanking ||
                    item.ranking_id === historyRanking
                )
                .map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label>Situação</label>
            <select
              value={historyStatus}
              onChange={e => setHistoryStatus(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="validos">Válidos</option>
              <option value="estornados">Estornados</option>
            </select>
          </div>
        </div>

        <div className="grid">
          <div>
            <label>Data inicial (Brasília)</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label>Data final (Brasília)</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <p>
          <strong>
            {filteredResults.length} lançamento(s) encontrado(s)
          </strong>
        </p>

        <p className="muted small">
          Total válido: {totals.wins} vitórias ·{' '}
          {totals.goals} gols ·{' '}
          {totals.assists} assistências ·{' '}
          {formatPoints(totals.points)} pontos
        </p>

        <div className="line" style={{ flexWrap: 'wrap' }}>
          <button
            onClick={exportHistory}
            disabled={filteredResults.length === 0}
          >
            Exportar CSV para Excel
          </button>

          <button onClick={clearFilters}>
            Limpar filtros
          </button>

          <button disabled={busy} onClick={refresh}>
            Atualizar histórico
          </button>
        </div>

        {filteredResults.length === 0 && (
          <p className="muted">
            Nenhum lançamento encontrado.
          </p>
        )}

        {filteredResults.map(result => {
          const reversed = Boolean(result.reversed_at);

          return (
            <div className="history line" key={result.id}>
              <div>
                <strong>{result.player_name}</strong>

                <div className="muted small">
                  {result.ranking_name}
                </div>

                <div className="muted small">
                  {formatDate(result.created_at)}
                  {' · '}
                  {result.wins} V /
                  {' '}{result.goals} G /
                  {' '}{result.assists} A
                </div>

                <div className="muted small">
                  Registrado por:{' '}
                  {result.created_by_email || 'Não identificado'}
                </div>

                <div className="muted small">
                  Situação:{' '}
                  {reversed ? 'ESTORNADO' : 'VÁLIDO'}
                </div>

                {reversed && result.reversed_at && (
                  <div className="muted small">
                    Estornado em {formatDate(result.reversed_at)}
                    {' · '}
                    Por:{' '}
                    {result.reversed_by_email || 'Não identificado'}
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
