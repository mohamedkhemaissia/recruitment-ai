function FormField({ label, id, as = 'input', hint, ...props }) {
  const Control = as;

  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <Control id={id} className="field__control" {...props} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export default FormField;

