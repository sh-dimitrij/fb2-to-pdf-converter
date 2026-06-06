import styles from './ConversionOptions.module.css'

export function ConversionOptions({ options, onChange, disabled }) {
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    onChange({ ...options, [key]: (key === 'fontSize' || key === 'margin') ? Number(value) : value })
  }

  return (
    <section className={styles.section} aria-label="Параметры конвертации">
      <h2 className={styles.title}>Параметры</h2>
      <div className={styles.grid}>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="opt-page-size">Формат страницы</label>
          <select id="opt-page-size" className={styles.select} value={options.pageSize} onChange={set('pageSize')} disabled={disabled}>
            <option value="a4">A4 — 210 × 297 мм</option>
            <option value="a5">A5 — 148 × 210 мм</option>
            <option value="letter">Letter — 216 × 279 мм</option>
          </select>
        </div>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="opt-font-size">
            Размер шрифта <span className={styles.unit}>{options.fontSize} пт</span>
          </label>
          <input id="opt-font-size" type="range" min="9" max="18" step="1"
            value={options.fontSize} onChange={set('fontSize')} disabled={disabled} className={styles.range} />
        </div>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="opt-margin">
            Поля <span className={styles.unit}>{options.margin} мм</span>
          </label>
          <input id="opt-margin" type="range" min="10" max="35" step="1"
            value={options.margin} onChange={set('margin')} disabled={disabled} className={styles.range} />
        </div>
        <div className={styles.group}>
          <label className={styles.label} htmlFor="opt-line-height">Межстрочный интервал</label>
          <select id="opt-line-height" className={styles.select} value={options.lineHeight} onChange={set('lineHeight')} disabled={disabled}>
            <option value="1.3">Одинарный (1.3)</option>
            <option value="1.5">Полуторный (1.5)</option>
            <option value="1.8">Двойной (1.8)</option>
          </select>
        </div>
      </div>
      <div className={styles.checkRow}>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={options.includeTOC} onChange={set('includeTOC')} disabled={disabled} className={styles.checkbox} />
          Оглавление
        </label>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={options.includeCover} onChange={set('includeCover')} disabled={disabled} className={styles.checkbox} />
          Обложка (если есть в файле)
        </label>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={options.includeAnnotation} onChange={set('includeAnnotation')} disabled={disabled} className={styles.checkbox} />
          Аннотация
        </label>
      </div>
    </section>
  )
}
