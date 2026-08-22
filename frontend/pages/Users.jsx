import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Trash2, Shield, Mail } from "lucide-react";
import { toast } from "sonner";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rol: "OPERADOR",
  });
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data);
    } catch (err) {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/users", {
        ...formData,
        permisos: ["ingreso", "salida"],
      });
      toast.success("USUARIO CREADO CORRECTAMENTE");
      setShowModal(false);
      setFormData({ email: "", password: "", rol: "OPERADOR" });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear usuario");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este acceso?")) return;
    try {
      await api.delete(`/auth/users/${id}`);
      toast.success("ACCESO REVOCADO");
      fetchUsers();
    } catch (err) {
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
            Gestión de <span className="text-indigo-600">Staff</span>
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all"
        >
          <UserPlus size={14} /> Nuevo Usuario
        </button>
      </nav>

      <main className="p-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Usuario</th>
                <th className="px-8 py-5">Rol</th>
                <th className="px-8 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Mail size={16} />
                      </div>
                      <span className="font-bold text-slate-700">
                        {u.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span
                      className={`text-[9px] font-black px-3 py-1 rounded-lg border ${
                        u.rol === "ADMIN"
                          ? "bg-amber-50 text-amber-600 border-amber-100"
                          : "bg-blue-50 text-blue-600 border-blue-100"
                      }`}
                    >
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL DE CREACIÓN (Simple y efectivo) */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-xl font-black uppercase text-slate-800 mb-6">
              Nuevo Acceso
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="email"
                placeholder="Email del empleado"
                required
                className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none font-bold"
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              <input
                type="password"
                placeholder="Contraseña temporal"
                required
                className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none font-bold"
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
              <select
                className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none font-bold"
                onChange={(e) =>
                  setFormData({ ...formData, rol: e.target.value })
                }
              >
                <option value="OPERADOR">OPERADOR</option>
                <option value="ADMIN">ADMINISTRADOR</option>
              </select>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 font-black text-[10px] uppercase text-slate-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
                >
                  Crear Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
