import { STATUS } from '../hooks/useConverter'
import styles from './ConvertButton.module.css'

export function ConvertButton({ items, isConverting, onClick }) {
  const pendingCount = items.filter(
    i => i.status === STATUS.IDLE || i.status === STATUS.ERROR
  ).length
  const doneCount = items.filter(i => i.status === STATUS.DONE).length

  const disabled = isConverting || pendingCount === 0

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.btn}
        onClick={onClick}
        disabled={disabled}
        type="button"
      >
        {isConverting ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            Конвертация…
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M9 15l3 3 3-3M12 12v6"/>
            </svg>
            {pendingCount > 0
              ? `Конвертировать ${pendingCount > 1 ? `${pendingCount} файла` : 'файл'} в PDF`
              : 'Конвертировать в PDF'
            }
          </>
        )}
      </button>

      {doneCount > 0 && !isConverting && (
        <p className={styles.doneNote}>
          ✓ {doneCount} {pluralSaved(doneCount)} сохранено в папку загрузок
        </p>
      )}
    </div>
  )
}

function pluralSaved(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'файл'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'файла'
  return 'файлов'
}


