export default function KpiCard({ title, value, hint }) {
  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">{title}</span>
        <span className="card__hint">{hint}</span>
      </div>
      <div className="card__value">{value}</div>
    </div>
  );
}