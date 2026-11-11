import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CircleHelp,
  History,
  LogOut,
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
  const [cashDialog, setCashDialog] = useState(null);
  const [reviewDate, setReviewDate] = useState(false);
  const [version, setVersion] = useState(0);
  const [connection, setConnection] = useState("connecting");
  const [reconnect, setReconnect] = useState(0);
  const queryAbort = useRef(null);
  const quoteAbort = useRef(null);
  const searchRef = useRef(null);
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
      .then(([stays, config, summary]) =>
        setData({
          stays: stays.data,
          config: config.data,
          summary: summary.data,
          loading: false,
          error: "",
        }),
      )
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
      .then(({ data: value }) => setCash({ status: "open", value, error: "" }))
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
  useEffect(() => {
    refresh();
    return () => {
      queryAbort.current?.abort();
      quoteAbort.current?.abort();
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
    (type, result) => {
      refresh();
      setVersion((value) => value + 1);
      if (type === "INGRESO" || type === "SALIDA") {
        if (type === "SALIDA") {
          setSelected(null);
          setQuote({ value: null, loading: false, error: null });
        }
        toast.success(
          type === "INGRESO"
            ? `Ingreso registrado · ${result.patente}`
            : `Cobro registrado · ${result.patente} · ${money(result.monto)}`,
          {
            action: { label: "Comprobante", onClick: () => setReceipt(result) },
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
    [refresh],
  );
  const operations = useOperations(
    `${user.email}/${user.sucursal.id}`,
    onOperation,
  );
  const pendingExit = operations.pending.some((item) => item.type === "SALIDA");
  const openCash = cash.status === "open" ? cash.value : null;
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
      .then(({ data: value }) =>
        setQuote({ value, loading: false, error: null }),
      )
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
  const filtered = data.stays.filter((stay) =>
    stay.patente.includes(term.trim().toUpperCase()),
  );
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
            <span className="sf-eyebrow">Operación de la sucursal</span>
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
          <button className="sf-text-button" onClick={refresh}>
            <RefreshCw size={15} />
            Actualizar datos
          </button>
        </div>
        {cash.status === "error" && (
          <p className="sf-notice sf-error" role="alert">
            {cash.error}{" "}
            <button className="sf-button" onClick={refresh}>
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
                <span className="sf-eyebrow">Vehículos en planta</span>
                <h2>Buscar y cotizar</h2>
              </div>
              <span className="sf-hint">
                {filtered.length} de {data.stays.length} activos
              </span>
            </header>
            <label className="sf-search">
              <Search size={20} />
              <span className="sr-only">Buscar patente activa</span>
              <input
                ref={searchRef}
                placeholder="Buscar patente…"
                autoComplete="off"
                value={term}
                onChange={(event) => setTerm(event.target.value.toUpperCase())}
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
              canQuote={
                hasPermission("salida") && !operations.busy && !pendingExit
              }
              onQuote={fetchQuote}
              courtesy={Number(
                data.config?.tiempo_cortesia_min ??
                  user.sucursal.tiempo_cortesia_min ??
                  0,
              )}
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
          <OwnReceipts version={version} onView={setReceipt} />
        )}
        <footer className="sf-footer">
          <CircleHelp size={16} />
          <span>
            Atajos: <kbd>N</kbd> nuevo ingreso · <kbd>/</kbd> buscar. Consultas
            y cotizaciones no registran un cobro.
          </span>
          <span>
            Hora de Buenos Aires · ARS <ArrowUpRight size={14} />
          </span>
        </footer>
      </main>
      {cashDialog && isAdmin && (
        <CashModal
          key={`${cashDialog.mode}-${cashDialog.cash?.id || "new"}`}
          mode={cashDialog.mode}
          cash={cashDialog.cash}
          operations={operations}
          onClose={() => setCashDialog(null)}
          onConfirm={({ amount, notes }) =>
            operations.run(
              cashDialog.mode === "open" ? "CAJA_ABRIR" : "CAJA_CERRAR",
              {
                url:
                  cashDialog.mode === "open"
                    ? "/cash/abrir"
                    : `/cash/${cashDialog.cash.id}/cerrar`,
                body:
                  cashDialog.mode === "open"
                    ? { notas: notes }
                    : { monto_real: amount, notas: notes },
              },
            )
          }
        />
      )}
      {receipt && (
        <TicketModal
          key={receipt.id}
          isOpen
          ticketData={receipt}
          onClose={() => setReceipt(null)}
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
