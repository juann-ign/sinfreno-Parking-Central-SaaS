"""Permisos locales existentes; SUPERADMIN sólo tiene accesos globales explícitos."""

LOCAL_PERMISSIONS = frozenset({
    "ingreso", "salida", "ver_ocupacion", "ver_stats", "ver_historial", "config_sucursal",
})
OPERATOR_PERMISSIONS = LOCAL_PERMISSIONS - {"config_sucursal"}
OPERATIONAL_PERMISSIONS = OPERATOR_PERMISSIONS


def normalized_role(user):
    return (user.rol or "").strip().upper()


def effective_permissions(user):
    role = normalized_role(user)
    if role == "ADMIN":
        return LOCAL_PERMISSIONS
    if role == "OPERADOR":
        return frozenset(part.strip() for part in (user.permisos or "").split(",")) & OPERATOR_PERMISSIONS
    return frozenset()


def can_operate(user):
    return bool(effective_permissions(user) & OPERATIONAL_PERMISSIONS)
