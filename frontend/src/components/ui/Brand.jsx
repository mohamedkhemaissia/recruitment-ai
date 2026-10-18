import logoUrl from '../../assets/bee-coders-logo.svg';

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <img className="brand__logo" src={logoUrl} alt="Bee Coders" />
    </div>
  );
}

export default Brand;
