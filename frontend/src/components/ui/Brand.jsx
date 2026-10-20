function Brand({ compact = false, inverse = false }) {
  return (
    <div
      className={`brand ${compact ? 'brand--compact' : ''} ${inverse ? 'brand--inverse' : ''}`.trim()}
      aria-label="Bee Coders"
    >
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="M27.6 4.9 5.1 13.8l8.5 3.3 3.4 9 10.6-21.2Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="m13.6 17.1 14-12.2-10.6 21.2-.8-6.7-2.6-2.3Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M4.2 21.3c3.1.1 5.4 1.1 7 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="brand__copy">
        <strong>Bee Coders</strong>
      </span>
    </div>
  );
}

export default Brand;
