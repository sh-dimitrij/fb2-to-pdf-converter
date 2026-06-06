import styles from './HowItWorks.module.css'

const STEPS = [
  { num: '01', title: 'Выберите файлы', desc: 'Перетащите один или несколько .fb2 в зону загрузки' },
  { num: '02', title: 'Настройте', desc: 'Формат, шрифт, поля — под ваши предпочтения' },
  { num: '03', title: 'Конвертируйте', desc: 'Нажмите кнопку — всё происходит в браузере' },
  { num: '04', title: 'Скачайте', desc: 'PDF сохраняется с именем книги' },
]

export function HowItWorks() {
  return (
    <section className={styles.section} aria-label="Как это работает">
      <h2 className={styles.title}>Как это работает</h2>
      <div className={styles.steps}>
        {STEPS.map(s => (
          <div key={s.num} className={styles.step}>
            <div className={styles.num}>{s.num}</div>
            <div className={styles.stepTitle}>{s.title}</div>
            <div className={styles.desc}>{s.desc}</div>
          </div>
        ))}
      </div>

      <div className={styles.note}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Файлы не покидают ваш браузер. Вся обработка происходит локально.
      </div>
    </section>
  )
}

