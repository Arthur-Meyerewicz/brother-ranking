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
      </section>

      <section className="panel">
        <h2>📋 Histórico administrativo</h2>
        <p className="muted small">Consulte lançamentos, responsáveis e estornos. O resumo considera somente registros válidos.</p>
        <div className="grid">
          <div>
            <label>Categoria</label>
            <select value={historyRanking} onChange={e => { setHistoryRanking(e.target.value); setHistoryPlayer(''); }}>
              <option value="">Todas</option>
              {rankings.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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
          <div><label>Data inicial (UTC)</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><label>Data final (UTC)</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
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
                <div className="muted small">{result.ranking_name}</div>
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
      </section>
    </main>
  );
}
