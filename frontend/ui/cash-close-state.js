function normalizedAmount(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return text;
  const whole = match[2].replace(/^0+(?=\d)/, "");
  const fraction = (match[3] || "").replace(/0+$/, "");
  const nonzero = whole !== "0" || fraction !== "";
  return `${match[1] === "-" && nonzero ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function cashFinancialFingerprint(cash) {
  if (!cash) return null;
  return JSON.stringify([
    cash.revision_cierre ?? null,
    normalizedAmount(cash.recaudacion_total),
    normalizedAmount(cash.fondo_inicial),
    normalizedAmount(cash.monto_esperado),
    Object.entries(cash.totales_por_medio || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([method, amount]) => [method, normalizedAmount(amount)]),
  ]);
}

function sameId(left, right) {
  return left !== null && left !== undefined && String(left) === String(right);
}

// This check also runs against a fresh status response before a new command is
// persisted. Recovery of an existing command must keep its original request.
export function checkCashClose({ cashId, fingerprint }, cashState) {
  const blocked = (code, reason) => ({ allowed: false, code, reason });
  if (!cashState || cashState.status === "loading")
    return blocked(
      "loading",
      "Estamos verificando el estado del turno. Esperá antes de confirmar el cierre.",
    );
  if (cashState.status === "closed")
    return blocked(
      "closed",
      `El turno #${cashId} ya no está abierto. No se puede iniciar otro cierre desde este diálogo.`,
    );
  if (cashState.status !== "open" || !cashState.value)
    return blocked(
      "unavailable",
      "No pudimos verificar el estado del turno. Tus datos se conservaron; actualizá la caja antes de confirmar.",
    );
  const current = cashState.value;
  if (!sameId(cashId, current.id))
    return blocked(
      "replaced",
      `El turno #${cashId} ya no es la caja abierta. Ahora está abierto el turno #${current.id}; este diálogo conserva el turno original y no cerrará el nuevo.`,
    );
  if (current.estado !== "ABIERTA")
    return blocked(
      "closed",
      `El turno #${cashId} ya no está abierto. No se puede iniciar otro cierre desde este diálogo.`,
    );
  if (current.origen_datos !== "UTC_POR_TURNO")
    return blocked(
      "legacy",
      "Este turno heredado requiere conciliación histórica. No hay un desglose de efectivo confiable y no se admite un cierre automático. Sus importes originales se conservan en Turnos, sin reinterpretar.",
    );
  if (
    typeof current.revision_cierre !== "string" ||
    !current.revision_cierre.trim()
  )
    return blocked(
      "unavailable",
      "Falta verificar la revisión de este turno. Actualizá la caja antes de confirmar el cierre.",
    );
  if (!fingerprint || fingerprint !== cashFinancialFingerprint(current))
    return blocked(
      "changed",
      "Los importes del turno cambiaron. Revisá los totales actualizados y volvé a contar el efectivo antes de confirmar.",
    );
  return { allowed: true, code: null, reason: "" };
}

export function createCashCloseState(cash) {
  return {
    selectedId: cash?.id ?? null,
    cash,
    currentCash: cash,
    status: cash ? "open" : "loading",
    error: "",
    amount: "",
    notes: "",
    fingerprint: cashFinancialFingerprint(cash),
    financialRevision: 0,
    reviewedRevision: 0,
  };
}

export function syncCashCloseState(state, cashState) {
  const status = cashState?.status || "loading";
  const error = cashState?.error || "";
  const current = cashState?.value;
  const matching = status === "open" && sameId(state.selectedId, current?.id);
  const cash = matching ? current : state.cash;
  const fingerprint = matching
    ? cashFinancialFingerprint(current)
    : state.fingerprint;
  const changed = fingerprint !== state.fingerprint;
  // Keep the selected turn's latest snapshot when status becomes unavailable or
  // another turn opens. Never adopt that new ID or erase the operator's count.
  if (
    state.status === status &&
    state.error === error &&
    state.cash === cash &&
    !changed &&
    state.currentCash === current
  )
    return state;
  return {
    ...state,
    cash,
    status,
    error,
    currentCash: current,
    fingerprint,
    financialRevision: state.financialRevision + Number(changed),
  };
}

export function cashCloseStateCheck(state) {
  return checkCashClose(
    { cashId: state.selectedId, fingerprint: state.fingerprint },
    {
      status: state.status,
      error: state.error,
      value: state.currentCash,
    },
  );
}

export function setCashCloseIntent(state, intent) {
  return {
    ...state,
    ...(intent.amount !== undefined ? { amount: intent.amount } : {}),
    ...(intent.notes !== undefined ? { notes: intent.notes } : {}),
  };
}

export function acknowledgeCashCloseState(state) {
  if (!cashCloseStateCheck(state).allowed) return state;
  return { ...state, reviewedRevision: state.financialRevision };
}

export function cashCloseNeedsReview(state) {
  return state.financialRevision !== state.reviewedRevision;
}

export function cashCloseConfirmation(state) {
  if (!cashCloseStateCheck(state).allowed || cashCloseNeedsReview(state))
    return null;
  return {
    amount: state.amount.replace(",", "."),
    notes: state.notes,
    cashId: state.selectedId,
    fingerprint: state.fingerprint,
  };
}
