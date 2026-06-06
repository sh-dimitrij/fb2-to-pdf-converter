import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.eyebrow}>Бесплатный онлайн-конвертер | Без загрузки на сервер</div>
      <h1 className={styles.title}>
        FB2 <span className={styles.arrow}>→</span> PDF
      </h1>
      <p className={styles.subtitle}>
        Конвертируйте электронные книги прямо в браузере.<br />
        Приватно, быстро, бесплатно.
      </p>
    </header>
  )
}


