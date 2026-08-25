import os
import re

for root, _, files in os.walk('tests'):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find 'email=...,' and add 'phone="1234567890",' on the next line
            # Wait, what if it already has phone?
            # It's better to add phone after email if it's missing phone.
            new_content = re.sub(
                r'(email=.*,)(?!\s*phone=)', 
                r'\1\n                phone="1234567890",', 
                content
            )

            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
