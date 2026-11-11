import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function PageHeader({ title, subtitle, children }) {
  return (
    <header className="sf-topbar sf-page-header">
      <Link className="sf-nav-link" to="/dashboard">
        <ArrowLeft size={18} />
        Volver a operación
      </Link>
      <div className="sf-page-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
