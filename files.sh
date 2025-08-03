
echo "" > all_files.txt

find . \
  -type f \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/package-lock.json" \
  ! -path "*/database.sqlite" \
  ! -path "*/all_files.txt" \
  ! -path "*/next_steps.txt" \
  ! -path "*/clipboard.txt" \
  | while read file; do
      echo "# ${file#/path/to/root/}"
      echo "# ${file#/path/to/root/}" >> all_files.txt
      cat "$file" >> all_files.txt
      echo "" >> all_files.txt
    done
