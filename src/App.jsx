import { useState } from 'react'
import { useConverter } from './hooks/useConverter'
import { Header } from './components/Header'
import { DropZone } from './components/DropZone'
import { FileList } from './components/FileList'
import { ConversionOptions } from './components/ConversionOptions'
import { ConvertButton } from './components/ConvertButton'
import { HowItWorks } from './components/HowItWorks'
import './index.css'
import styles from './App.module.css'

const DEFAULT_OPTIONS = {
  pageSize: 'a4',
  fontSize: 15,
  margin: 25,
  lineHeight: '1.3',
  includeCover: true,
  includeTOC: true,
  includeAnnotation: true,
}

export default function App() {
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const { items, isConverting, addFiles, removeItem, clearAll, convertAll } = useConverter()

  const handleConvert = () => {
    convertAll({ ...options, lineHeight: parseFloat(options.lineHeight) })
  }

  return (
    <>
      <Header />
      <main className={styles.main}>
        <DropZone onFiles={addFiles} disabled={false} />
        <FileList items={items} onRemove={removeItem} onClearAll={clearAll} />
        <ConversionOptions options={options} onChange={setOptions} disabled={isConverting} />
        <ConvertButton items={items} isConverting={isConverting} onClick={handleConvert} />
        <HowItWorks />
      </main>
      <footer className={styles.footer}>
        Обработка происходит полностью в браузере — файлы не покидают ваше устройство.
        &nbsp;·&nbsp;
        <a href="https://github.com/sh-dimitrij/fb2-to-pdf-converter" target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </>
  )
}

