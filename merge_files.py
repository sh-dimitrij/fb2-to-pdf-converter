# Программа для объединения указанных файлов в один файл merge.txt

# УКАЖИТЕ ЗДЕСЬ ПУТИ К ВАШИМ ФАЙЛАМ
file_paths = [
    "eslint.config.js", 
    "index.html",
    "package.json",
    "vite.config.js",
    "src/App.jsx",
    "src/App.module.css",
    "src/index.css",
    "src/main.jsx",
    "src/components/ConversionOptions.jsx",
    "src/components/ConversionOptions.module.css",
    "src/components/ConvertButton.jsx",
    "src/components/ConvertButton.module.css",
    "src/components/DropZone.jsx",
    "src/components/DropZone.module.css",
    "src/components/FileList.jsx",
    "src/components/FileList.module.css",
    "src/components/Header.jsx",
    "src/components/Header.module.css",
    "src/components/HowItWorks.jsx",
    "src/components/HowItWorks.module.css",
    "src/hooks/useConverter.js",
    "src/hooks/useDropZone.js",
    "src/utils/fb2Parser.js",
    "src/utils/fonts.js",
    "src/utils/pdfGenerator.js"
]

output_file = "merge_f.txt"

print("Начинаю объединение файлов...")
print("-" * 50)

# Счетчики для статистики
success_count = 0
error_count = 0

# Открываем файл для записи результата
with open(output_file, 'w', encoding='utf-8') as outfile:
    for i, file_path in enumerate(file_paths, 1):
        try:
            # Пытаемся открыть и прочитать файл
            with open(file_path, 'r', encoding='utf-8') as infile:
                content = infile.read()
                
                # Записываем заголовок с именем файла для наглядности
                outfile.write(f"\n{'='*60}\n")
                outfile.write(f"Файл: {file_path}\n")
                outfile.write(f"{'='*60}\n\n")
                
                # Записываем содержимое файла
                outfile.write(content)
                
                # Добавляем перенос строки, если его нет в конце
                if content and not content.endswith('\n'):
                    outfile.write('\n')
                
                outfile.write("\n")  # Дополнительный перенос после файла
                
                print(f"✓ [{i}/{len(file_paths)}] Успешно: {file_path}")
                success_count += 1
                
        except FileNotFoundError:
            print(f"✗ [{i}/{len(file_paths)}] Файл не найден: {file_path}")
            error_count += 1
            
        except PermissionError:
            print(f"✗ [{i}/{len(file_paths)}] Нет доступа: {file_path}")
            error_count += 1
            
        except UnicodeDecodeError:
            print(f"✗ [{i}/{len(file_paths)}] Ошибка кодировки: {file_path} (попробуйте изменить кодировку)")
            error_count += 1
            
        except Exception as e:
            print(f"✗ [{i}/{len(file_paths)}] Ошибка при чтении {file_path}: {e}")
            error_count += 1

print("-" * 50)
print(f"\nГотово!")
print(f"✅ Успешно обработано: {success_count} файлов")
print(f"❌ Ошибок: {error_count} файлов")
print(f"📄 Результат сохранен в файл: {output_file}")

# Дополнительно: показываем размер полученного файла
import os
if os.path.exists(output_file):
    size = os.path.getsize(output_file)
    if size < 1024:
        size_str = f"{size} байт"
    elif size < 1024 * 1024:
        size_str = f"{size / 1024:.2f} КБ"
    else:
        size_str = f"{size / (1024 * 1024):.2f} МБ"
    print(f"📊 Размер файла: {size_str}")