import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  History,
  LogOut,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../src/context/useAuth.js";
import api from "../api/axios.js";
import { useOperations } from "../api/useOperations.js";
import { connectAuthenticatedSocket } from "../api/realtime.js";
import { SESSION_ENDED_EVENT } from "../api/session.js";
import { getWebSocketUrl } from "../config/connections.js";
import { errorMessage, money } from "../ui/format.js";
import { checkCashClose } from "../ui/cash-close-state.js";
import { searchActiveStays } from "../ui/stay-search.js";
import EntryForm from "../components/EntryForm.jsx";
import ActiveTable from "../components/ActiveTable.jsx";
import CashModal from "../components/CashModal.jsx";
import TicketModal from "../components/TicketModal.jsx";
import OwnReceipts from "../components/OwnReceipts.jsx";
import QuotePanel from "../components/QuotePanel.jsx";
import PendingOperations from "../components/PendingOperations.jsx";
import ReviewDateDialog from "../components/ReviewDateDialog.jsx";

export default function Dashboard({ onLogout }) {
  const { user, hasPermission, login, logout } = useAuth();
  const isAdmin = user.rol === "ADMIN";
  const [data, setData] = useState({
    stays: [],
    config: null,
    summary: null,
    loading: true,
    error: "",
  });
  const [cash, setCash] = useState({
    status: "loading",
    value: null,
    error: "",
  });
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState(null);
  const [quote, setQuote] = useState({
    value: null,
    loading: false,
    error: null,
  });
  const [receipt, setReceipt] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const printSettingKey = `sinfreno:imprimir-al-registrar:${user.sucursal.id}`;
  const [printOnRegister, setPrintOnRegister] = useState(
    () => localStorage.getItem(printSettingKey) === "1",
  );
  const [cashDialog, setCashDialog] = useState(null);
  const [cashChecking, setCashChecking] = useState(false);
  const [reviewDate, setReviewDate] = useState(false);
  const [version, setVersion] = useState(0);
  const [connection, setConnection] = useState("connecting");
  const [reconnect, setReconnect] = useState(0);
  const queryAbort = useRef(null);
  const quoteAbort = useRef(null);
  const cashCheckAbort = useRef(null);
  const cashCheckLock = useRef(false);
  const searchRef = useRef(null);
  const focusNextOperation = useCallback((type) => {
    requestAnimationFrame(() => {
      if (document.querySelector("dialog[open]")) return;
      if (type === "INGRESO") {
        document.getElementById("entry-plate")?.focus();
      } else {
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    });
  }, []);
  const closeReceipt = useCallback(() => {
    setReceipt(null);
    if (receipt?.operation) focusNextOperation(receipt.operation);
  }, [receipt, focusNextOperation]);
  const viewReceipt = (data) => setReceipt({ data });
  const refresh = useCallback(() => {
    queryAbort.current?.abort();
    const controller = new AbortController();
    queryAbort.current = controller;
    const options = { signal: controller.signal, timeout: 12000 };
    Promise.all([
      api.get("/parking/activas", options),
      api.get("/parking/config", options),
      api.get("/stats/summary", options),
    ])
      .then(([stays, config, summary]) => {
        if (controller.signal.aborted) return;
        setData({
          stays: stays.data,
          config: config.data,
          summary: summary.data,
          loading: false,
          error: "",
        });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setData((previous) => ({
            ...previous,
            loading: false,
            error: errorMessage(
              failure,
              "No pudimos actualizar la lista. Los datos anteriores pueden estar desactualizados.",
            ),
          }));
      });
    api
      .get("/cash/status", options)
      .then(({ data: value }) => {
        if (!controller.signal.aborted)
          setCash({ status: "open", value, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setCash({
            status: failure.response?.status === 404 ? "closed" : "error",
            value: null,
            error:
              failure.response?.status === 403
                ? "No tenés permiso para consultar la caja."
                : "No pudimos consultar el estado de caja. Reintentá antes de operar.",
          });
      });
  }, []);
  const refreshRequested = () => {
    setCash((previous) => ({ ...previous, status: "loading", error: "" }));
    refresh();
  };
  useEffect(() => {
    refresh();
    return () => {
      queryAbort.current?.abort();
      quoteAbort.current?.abort();
      cashCheckAbort.current?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    const shortcut = (event) => {
      if (
        document.querySelector("dialog[open]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) ||
        event.target.isContentEditable
      )
        return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        document.getElementById("entry-plate")?.focus();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    const token = localStorage.getItem("token");
    const stop = connectAuthenticatedSocket({
      url: getWebSocketUrl(user.sucursal.id),
      token,
      onStatus: setConnection,
      onReady: refresh,
      onEvent: ({ event, id }) => {
        refresh();
        setVersion((value) => value + 1);
        if (event === "NUEVA_SALIDA")
          setSelected((previous) => (previous?.id === id ? null : previous));
        if (event === "CONFIG_UPDATED")
          api
            .get("/auth/me", { sessionToken: token, timeout: 12000 })
            .then(({ data: profile }) => login(profile, token))
            .catch(() => {});
      },
      onUnauthorized: () => {
        if (localStorage.getItem("token") === token) logout();
      },
      onForbidden: () => setConnection("forbidden"),
      onUnavailable: () => setConnection("offline"),
    });
    window.addEventListener(SESSION_ENDED_EVENT, stop);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, stop);
      stop();
    };
  }, [user.sucursal.id, login, logout, refresh, reconnect]);
  const onOperation = useCallback(
    (type, result, mode) => {
      refresh();
      setVersion((value) => value + 1);
      if (type === "INGRESO" || type === "SALIDA") {
        setLastReceipt(result);
        const shouldPrint = printOnRegister && mode === "initial";
        if (shouldPrint) {
          setReceipt({ data: result, autoPrint: true, operation: type });
        } else if (type === "SALIDA") {
          focusNextOperation(type);
        }
        if (type === "SALIDA") {
          setSelected(null);
          setQuote({ value: null, loading: false, error: null });
        }
        toast.success(
          type === "INGRESO"
            ? `Ingreso registrado · ${result.patente}`
            : `Cobro registrado · ${result.patente} · ${money(result.monto)}`,
          {
            action: shouldPrint ? undefined : {
              label: "Ver ticket", onClick: () => setReceipt({ data: result }),
            },
            duration: 7000,
          },
        );
      } else {
        setCashDialog(null);
        toast.success(
          type === "CAJA_ABRIR"
            ? `Turno #${result.id} abierto`
            : `Turno #${result.id} cerrado`,
        );
      }
    },
    [refresh, printOnRegister, focusNextOperation],
  );
  const operations = useOperations(
    `${user.email}/${user.sucursal.id}`,
    onOperation,
  );
  const pendingExit = operations.pending.some((item) => item.type === "SALIDA");
  const openCash = cash.status === "open" ? cash.value : null;
  const confirmCash = async ({ amount, notes, cashId, fingerprint }) => {
    if (!cashDialog) return;
    if (cashDialog.mode === "open") {
      return operations.run("CAJA_ABRIR", {
        url: "/cash/abrir", body: { notas: notes },
      });
    }
    const selectedId = cashDialog.cash?.id;
    if (cashCheckLock.current || cashId !== selectedId ||
      operations.pending.some((attempt) => attempt.type === "CAJA_CERRAR")) return;
    cashCheckLock.current = true;
    const controller = new AbortController();
    cashCheckAbort.current = controller;
    const token = localStorage.getItem("token");
    setCashChecking(true);
    operations.clearError();
    try {
      const { data: value } = await api.get("/cash/status", {
        signal: controller.signal, sessionToken: token, timeout: 12000,
      });
      if (controller.signal.aborted || localStorage.getItem("token") !== token) return;
      const fresh = { status: "open", value, error: "" };
      setCash(fresh);
      if (!checkCashClose({ cashId: selectedId, fingerprint }, fresh).allowed) return;
      await operations.run("CAJA_CERRAR", {
        url: `/cash/${selectedId}/cerrar`,
        body: { monto_real: amount, notas: notes, revision_cierre: value.revision_cierre },
      });
      if (!controller.signal.aborted) refresh();
    } catch (failure) {
      if (!controller.signal.aborted && localStorage.getItem("token") === token) {
        setCash({
          status: failure.response?.status === 404 ? "closed" : "error",
          value: null,
          error: "No pudimos verificar el turno seleccionado. Conservamos el conteo; actualizá antes de confirmar.",
        });
      }
    } finally {
      cashCheckLock.current = false;
      if (!controller.signal.aborted) setCashChecking(false);
    }
  };
  const fetchQuote = useCallback((stay) => {
    quoteAbort.current?.abort();
    const controller = new AbortController();
    quoteAbort.current = controller;
    setSelected(stay);
    setQuote({ value: null, loading: true, error: null });
    api
      .post(`/parking/${stay.id}/cotizaciones`, null, {
        signal: controller.signal,
        timeout: 12000,
      })
      .then(({ data: value }) => {
        if (!controller.signal.aborted)
          setQuote({ value, loading: false, error: null });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setQuote({
            value: null,
            loading: false,
            error: {
              message: errorMessage(
                failure,
                "No pudimos calcular la cotización.",
              ),
              code: failure.response?.data?.detail?.code,
            },
          });
      });
  }, []);
  const { matches: filtered, exact } = searchActiveStays(data.stays, term);
  const canQuote = hasPermission("salida") && !operations.busy && !pendingExit;
  const cashText = {
    loading: "Consultando caja…",
    closed: "Caja cerrada",
    error: "Caja no consultable",
    open: `Caja abierta · turno #${openCash?.id}`,
  }[cash.status];
  const connectionText =
    {
      connecting: "Conectando actualizaciones",
      connected: "Actualizado en tiempo real",
      reconnecting: "Reconectando actualizaciones",
      offline: "Conexión en tiempo real interrumpida",
      forbidden: "Actualizaciones sin autorización",
    }[connection] || "Conectando actualizaciones";
  return (
    <div className="sf-app">
      <header className="sf-topbar">
        <Link className="sf-brand" to="/">
          Sinfreno<span>.</span>
        </Link>
        <div className="sf-branch">
          <strong>{user.sucursal.nombre}</strong>
          <small>
            {user.email} · {isAdmin ? "Administrador" : "Operador"}
          </small>
        </div>
        <nav aria-label="Navegación principal">
          {hasPermission("ver_historial") && (
            <Link className="sf-nav-link" to="/history">
              <History size={18} />
              Historial
            </Link>
          )}
          {isAdmin && (
            <>
              <Link className="sf-nav-link" to="/cash-history">
                <Wallet size={18} />
                Turnos
              </Link>
              <Link className="sf-nav-link" to="/users">
                <Users size={18} />
                Equipo
              </Link>
              <Link className="sf-nav-link" to="/settings">
                <Settings size={18} />
                Configuración
              </Link>
            </>
          )}
          <button className="sf-nav-link" onClick={onLogout}>
            <LogOut size={18} />
            Salir
          </button>
        </nav>
      </header>
      <main className="sf-workspace">
        <div className="sf-workspace-title">
          <div>
            <h1>Entradas y salidas</h1>
          </div>
          <div className="sf-cash-status">
            <span
              className={`sf-badge ${cash.status === "open" ? "sf-badge-success" : "sf-badge-warning"}`}
            >
              {cashText}
            </span>
            {isAdmin &&
              cash.status !== "loading" &&
              cash.status !== "error" && (
                <button
                  className="sf-button"
                  disabled={operations.busy}
                  onClick={() => {
                    operations.clearError();
                    setCashDialog({
                      mode: openCash ? "close" : "open",
                      cash: openCash,
                    });
                  }}
                >
                  {openCash ? "Cerrar turno" : "Abrir caja"}
                </button>
              )}
          </div>
        </div>
        <div className="sf-status-row">
          <span className={connection === "connected" ? "sf-live" : "sf-muted"}>
            {connectionText}
          </span>
          {connection !== "connected" && connection !== "connecting" && (
            <button
              className="sf-text-button"
              onClick={() => setReconnect((value) => value + 1)}
            >
              Reconectar
            </button>
          )}
          <button className="sf-text-button" onClick={refreshRequested}>
            <RefreshCw size={15} />
            Actualizar datos
          </button>
          {(hasPermission("ingreso") || hasPermission("salida")) && (
            <label className="sf-print-setting">
              <input
                type="checkbox"
                checked={printOnRegister}
                disabled={operations.busy}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  localStorage.setItem(printSettingKey, enabled ? "1" : "0");
                  setPrintOnRegister(enabled);
                }}
              />
              Imprimir al registrar en este puesto
            </label>
          )}
          {lastReceipt && (
            <button
              className="sf-text-button"
              type="button"
              disabled={operations.busy}
              onClick={() => setReceipt({ data: lastReceipt, autoPrint: true })}
            >
              <Printer size={16} aria-hidden="true" /> Imprimir último ticket · {lastReceipt.patente}
            </button>
          )}
        </div>
        {cash.status === "error" && (
          <p className="sf-notice sf-error" role="alert">
            {cash.error}{" "}
            <button className="sf-button" onClick={refreshRequested}>
              Consultar nuevamente
            </button>
          </p>
        )}
        {cash.status === "closed" && (
          <p className="sf-notice sf-warning">
            La caja está cerrada. Podés buscar y cotizar;{" "}
            {isAdmin
              ? "abrí un turno para registrar ingresos o cobros."
              : "pedí a un administrador que abra el turno antes de registrar ingresos o cobros."}
          </p>
        )}
        <PendingOperations operations={operations} />
        {operations.error && !selected && !cashDialog && (
          <p className="sf-notice sf-error" role="alert">
            {operations.error}
          </p>
        )}
        {hasPermission("ingreso") && (
          <EntryForm
            towers={data.config?.torres || []}
            cashId={openCash?.id}
            busy={operations.busy}
            printOnRegister={printOnRegister}
            pending={operations.pending.some((item) => item.type === "INGRESO")}
            onSubmit={(body) =>
              operations.run("INGRESO", { url: "/parking/ingreso", body })
            }
          />
        )}
        {data.summary && (
          <section className="sf-summary" aria-label="Resumen de la sucursal">
            <div>
              <span>Vehículos activos</span>
              <strong>{data.summary.autos_adentro}</strong>
            </div>
            <div>
              <span>Plazas disponibles</span>
              <strong>{data.summary.capacidad_disponible}</strong>
            </div>
            {hasPermission("ver_stats") &&
              data.summary.recaudacion_hoy !== undefined && (
                <div>
                  <span>Recaudación del día</span>
                  <strong>{money(data.summary.recaudacion_hoy)}</strong>
                </div>
              )}
            {isAdmin &&
              openCash?.origen_datos === "UTC_POR_TURNO" &&
              openCash?.recaudacion_total !== undefined && (
                <div>
                  <span>Recaudación del turno #{openCash.id}</span>
                  <strong>{money(openCash.recaudacion_total)}</strong>
                </div>
              )}
          </section>
        )}
        <div className={`sf-operating-grid ${selected ? "sf-with-quote" : ""}`}>
          <section className="sf-card sf-active-list">
            <header className="sf-section-heading">
              <div>
                <h2>Buscar y cotizar</h2>
              </div>
              <span className="sf-hint">
                {filtered.length} de {data.stays.length} activos
              </span>
            </header>
            <label className="sf-search">
              <Search size={20} />
              <span className="sr-only">Buscar patente activa o número de ticket</span>
              <input
                ref={searchRef}
                placeholder="Patente o ticket (ej. #123)"
                autoComplete="off"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value.toUpperCase());
                  if (selected && !operations.busy && !pendingExit) {
                    quoteAbort.current?.abort();
                    setSelected(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (exact && canQuote && !event.repeat && !event.nativeEvent.isComposing)
                    fetchQuote(exact);
                }}
              />
              <kbd>/</kbd>
            </label>
            {data.error && (
              <p className="sf-notice sf-error" role="alert">
                {data.error}
              </p>
            )}
            <ActiveTable
              vehicles={filtered}
              towers={data.config?.torres || []}
              loading={data.loading}
              canQuote={canQuote}
              onQuote={fetchQuote}
            />
          </section>
          {selected && (
            <QuotePanel
              key={selected.id}
              stay={selected}
              quote={quote.value}
              loading={quote.loading}
              error={quote.error}
              cash={openCash}
              operations={operations}
              printOnRegister={printOnRegister}
              onRefresh={() => {
                operations.clearError();
                fetchQuote(selected);
              }}
              onClose={() => {
                quoteAbort.current?.abort();
                setSelected(null);
                refresh();
              }}
              canReview={isAdmin}
              onReview={() => setReviewDate(true)}
              onConfirm={(method) =>
                operations.run("SALIDA", {
                  url: `/parking/${selected.id}/salida`,
                  body: {
                    cotizacion_id: quote.value.id,
                    caja_id: openCash.id,
                    metodo_pago: method,
                  },
                })
              }
            />
          )}
        </div>
        {(hasPermission("ingreso") ||
          hasPermission("salida") ||
          hasPermission("ver_historial")) && (
          <OwnReceipts version={version} onView={viewReceipt} />
        )}
        <footer className="sf-footer">
          <span className="sf-icon-label">
            <Clock size={14} aria-hidden="true" /> Hora de Buenos Aires · ARS
          </span>
        </footer>
      </main>
      {cashDialog && isAdmin && (
        <CashModal
          key={`${cashDialog.mode}-${cashDialog.cash?.id || "new"}`}
          mode={cashDialog.mode}
          cash={cashDialog.cash}
          cashState={cash}
          checking={cashChecking}
          operations={operations}
          onRefresh={refreshRequested}
          onClose={() => setCashDialog(null)}
          onConfirm={confirmCash}
        />
      )}
      {receipt && (
        <TicketModal
          key={receipt.data.id}
          isOpen
          ticketData={receipt.data}
            branchConfig={data.config}
          autoPrint={receipt.autoPrint}
          onAfterAutoPrint={closeReceipt}
          onClose={closeReceipt}
        />
      )}
      {reviewDate && selected && (
        <ReviewDateDialog
          stay={selected}
          onClose={() => setReviewDate(false)}
          onReviewed={() => {
            setReviewDate(false);
            fetchQuote(selected);
            refresh();
          }}
        />
      )}
    </div>
  );
}
