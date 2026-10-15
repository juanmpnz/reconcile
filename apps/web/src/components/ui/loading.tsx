export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
export function Loading({
  label,
  rows = 0,
  inline = false,
}: {
  label: string;
  rows?: number;
  inline?: boolean;
}) {
  return (
    <div className={inline ? 'loading-inline' : 'loading-region'}>
      <div className="loading-status" role="status">
        <Spinner />
        <span>{label}</span>
      </div>
      {rows > 0 && (
        <div className="skeleton-table" aria-hidden="true" aria-busy="true">
          {Array.from({ length: rows }, (_, index) => (
            <div className="skeleton-row" key={index}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
