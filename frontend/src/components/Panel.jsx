export default function Panel({ title, right, children }) {
  return (
    <div className="panel">
      <div className="panel__head">
        <h2>{title}</h2>
        {right}
      </div>
      <div className="panel__body">{children}</div>
    </div>
  );
}