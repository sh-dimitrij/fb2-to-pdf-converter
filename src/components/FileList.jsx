import { STATUS } from '../hooks/useConverter'
import styles from './FileList.module.css'

function formatBytes(b) {
  if (b < 1024) return `${b} Б`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`
  return `${(b / 1024 / 1024).toFixed(1)} МБ`
}

const STATUS_LABEL = {
  [STATUS.IDLE]: null,
  [STATUS.PARSING]: 'Разбор файла…',
  [STATUS.GENERATING]: 'Генерация PDF…',
  [STATUS.DONE]: 'Готово',
  [STATUS.ERROR]: 'Ошибка',
}

export function FileList({ items, onRemove, onClearAll }) {
  if (!items.length) return null

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.count}>{items.length} {pluralFiles(items.length)}</span>
        <button className={styles.clearBtn} onClick={onClearAll} type="button">
          Очистить всё
        </button>
      </div>

      <ul className={styles.list}>
        {items.map(item => (
          <li key={item.id} className={`${styles.item} ${styles[item.status]}`}>
            <div className={styles.fileIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="12" y2="17"/>
              </svg>
            </div>

            <div className={styles.info}>
              <div className={styles.fileName}>
                {item.bookTitle
                  ? <><span className={styles.bookTitle}>«{item.bookTitle}»</span><span className={styles.origName}>{item.file.name}</span></>
                  : <span>{item.file.name}</span>
                }
              </div>

              <div className={styles.meta}>
                <span className={styles.size}>{formatBytes(item.file.size)}</span>
                {STATUS_LABEL[item.status] && (
                  <span className={`${styles.statusLabel} ${styles[`label_${item.status}`]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                )}
                {item.error && <span className={styles.error}>{item.error}</span>}
              </div>

              {(item.status === STATUS.PARSING || item.status === STATUS.GENERATING) && (
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${item.progress}%` }} />
                </div>
              )}
            </div>

            <div className={styles.statusIcon} aria-hidden="true">
              {item.status === STATUS.DONE && (
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
                </svg>
              )}
              {item.status === STATUS.ERROR && (
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              )}
              {(item.status === STATUS.PARSING || item.status === STATUS.GENERATING) && (
                <div className={styles.spinner} />
              )}
            </div>

            {item.status === STATUS.IDLE || item.status === STATUS.ERROR ? (
              <button
                className={styles.removeBtn}
                onClick={() => onRemove(item.id)}
                type="button"
                aria-label={`Удалить ${item.file.name}`}
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function pluralFiles(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'файл'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'файла'
  return 'файлов'
}


